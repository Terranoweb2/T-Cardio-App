'use client';

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { connectSockets, disconnectSockets, getEmergencySocket } from '@/lib/socket';
import { isNativePlatform, initCapacitorNotifications, showIncomingCallNotification, showLocalNotification } from '@/lib/capacitor-notifications';

export interface IncomingCallData {
  teleconsultationId: string;
  callerName: string;
  callerRole: string;
  callerId: string;
  isEmergency?: boolean;
}

interface SocketContextValue {
  connected: boolean;
  incomingCall: IncomingCallData | null;
  dismissIncomingCall: () => void;
}

const SocketContext = createContext<SocketContextValue>({
  connected: false,
  incomingCall: null,
  dismissIncomingCall: () => {},
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuthStore();
  const { addNotification, triggerEmergency, dismissEmergency } = useNotificationStore();
  const connectedRef = useRef(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);

  const dismissIncomingCall = useCallback(() => {
    setIncomingCall(null);
  }, []);

  useEffect(() => {
    if (isAuthenticated && user?.id && !connectedRef.current) {
      connectedRef.current = true;
      connectSockets(user.id, user.role);

      const emergencySocket = getEmergencySocket();

      // Listen for emergency events (doctor side)
      emergencySocket.on('emergency', (data: any) => {
        if (data.type === 'missed_call') {
          // Discreet notification — no emergency banner
          addNotification({
            id: data.id || `missed_call_${Date.now()}`,
            type: 'SYSTEM',
            title: 'Appel manque',
            message: data.message || 'Un patient essaie de vous appeler.',
            severity: 'MODERE',
            isRead: false,
            createdAt: new Date().toISOString(),
            patientId: data.patientId,
            patientName: data.patientName,
          });
          // Capacitor native notification for missed call
          if (isNativePlatform()) {
            showLocalNotification(
              'Appel manque',
              data.patientName ? `${data.patientName} a essaye de vous appeler.` : 'Un patient a essaye de vous appeler.',
              { type: 'missed_call', teleconsultationId: data.teleconsultationId },
            ).catch(() => {});
          }
        } else if (data.type === 'emergency_call') {
          // Emergency call — show persistent banner, deduplicate via same id
          addNotification({
            id: data.id || `emergency_call_${Date.now()}`,
            type: 'EMERGENCY',
            title: 'URGENCE - Appel teleconsultation',
            message: data.message,
            severity: 'CRITIQUE',
            isRead: false,
            createdAt: new Date().toISOString(),
            patientId: data.patientId,
            patientName: data.patientName,
          });
          // Force banner refresh on each repeat, pass emergency type + eventId
          triggerEmergency(data.message, data.teleconsultationId || data.id, data.emergencyType || 'free', data.id);

          // For PAID emergencies: also trigger the incoming call modal with ringtone
          // This creates an insistent call experience (ringtone + vibration + full-screen modal)
          if (data.emergencyType === 'paid') {
            setIncomingCall({
              teleconsultationId: data.teleconsultationId || data.id,
              callerName: data.patientName || 'Patient - URGENCE',
              callerRole: 'PATIENT',
              callerId: data.patientId || '',
              isEmergency: true,
            });
          }
        } else {
          // Standard emergency (BP critique, etc.)
          addNotification({
            id: data.id || `emergency_${Date.now()}`,
            type: 'EMERGENCY',
            title: 'Alerte urgence!',
            message: data.message || `Patient en situation critique - Sys: ${data.systolic}/${data.diastolic}`,
            severity: 'CRITIQUE',
            isRead: false,
            createdAt: new Date().toISOString(),
            patientId: data.patientId,
            patientName: data.patientName,
          });
        }
      });

      // Listen for emergency alerts (patient side)
      emergencySocket.on('emergency_alert', (data: any) => {
        addNotification({
          id: data.id || `alert_${Date.now()}`,
          type: 'EMERGENCY',
          title: 'Alerte urgente',
          message: data.message || 'Vos valeurs sont critiques. Contactez votre medecin immediatement.',
          severity: 'CRITIQUE',
          isRead: false,
          createdAt: new Date().toISOString(),
        });
        if (isNativePlatform()) {
          showLocalNotification('Alerte urgente', data.message || 'Vos valeurs sont critiques.', { type: 'emergency' }).catch(() => {});
        }
      });

      // Init Capacitor notifications for native platforms
      if (isNativePlatform()) {
        initCapacitorNotifications().catch(() => {});
      }

      // ========== INCOMING CALL NOTIFICATION (global) ==========
      // This fires when someone initiates a call, regardless of which page we are on
      emergencySocket.on('incoming_call', (data: IncomingCallData) => {
        console.log('[SocketContext] Incoming call received:', data);
        setIncomingCall(data);
        // Capacitor native notification for when the app is in background
        if (isNativePlatform()) {
          showIncomingCallNotification(data.callerName, data.teleconsultationId).catch(() => {});
        }
      });

      // When the call is cancelled (caller hung up, timeout, or rejected)
      emergencySocket.on('call_cancelled', (data: { teleconsultationId: string; reason: string }) => {
        console.log('[SocketContext] Call cancelled:', data);
        setIncomingCall((prev) => {
          if (prev?.teleconsultationId === data.teleconsultationId) {
            return null;
          }
          return prev;
        });
      });

      // When an emergency is resolved (accepted or refused by doctor)
      // This dismisses the emergency UI on the doctor's side after API call
      emergencySocket.on('emergency_resolved', (data: { eventId: string; status: string }) => {
        console.log('[SocketContext] Emergency resolved:', data);
        if (data.status === 'accepted') {
          // Doctor accepted — dismiss all emergency UI
          dismissEmergency();
          setIncomingCall(null);
        } else if (data.status === 'refused') {
          // Doctor refused — dismiss current UI, timer will re-trigger in 20s
          setIncomingCall(null);
          // Keep banner dismissed briefly — the next repeat notification will re-trigger it
          dismissEmergency();
        }
      });

      emergencySocket.on('connect_error', (err: Error) => {
        console.warn('Socket connection error:', err.message);
      });
    }

    return () => {
      if (connectedRef.current) {
        disconnectSockets();
        connectedRef.current = false;
      }
    };
  }, [isAuthenticated, user?.id]);

  return (
    <SocketContext.Provider value={{
      connected: connectedRef.current,
      incomingCall,
      dismissIncomingCall,
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
