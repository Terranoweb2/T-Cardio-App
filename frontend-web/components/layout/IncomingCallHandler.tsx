'use client';

import { useState } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import IncomingCallGlobal from '@/components/teleconsultation/IncomingCallGlobal';
import { usePathname } from 'next/navigation';
import { useNotificationStore } from '@/stores/notificationStore';
import api from '@/lib/api';

/**
 * Renders the global incoming call modal when a call is received via the emergency socket.
 * This component must be rendered INSIDE the SocketProvider.
 *
 * If the user is already on the teleconsultation page for this specific call,
 * we don't show the global modal (the in-page IncomingCallModal will handle it).
 *
 * For emergency calls: Accept/Refuse hit the backend API to acknowledge/refuse,
 * which stops or continues the repeating notification timer.
 */
export default function IncomingCallHandler() {
  const { incomingCall, dismissIncomingCall } = useSocket();
  const { emergencyEventId, emergencyTeleconsultationId, dismissEmergency } = useNotificationStore();
  const pathname = usePathname();
  const [realTcId, setRealTcId] = useState<string | null>(null);

  if (!incomingCall) return null;

  // Don't show global modal if user is already on this teleconsultation's detail page
  const isOnTeleconsultationPage = pathname === `/teleconsultations/${incomingCall.teleconsultationId}`;
  if (isOnTeleconsultationPage) return null;

  const handleAccept = async () => {
    let createdTcId: string | null = null;
    // For emergency calls: acknowledge via backend (creates teleconsultation + stops notifications)
    if (incomingCall.isEmergency && emergencyEventId) {
      try {
        const { data } = await api.post(`/emergency-calls/${emergencyEventId}/acknowledge`);
        createdTcId = data?.teleconsultationId || data?.data?.teleconsultationId || null;
      } catch (err) {
        console.error('[IncomingCallHandler] Acknowledge failed:', err);
      }
      dismissEmergency();
    }
    // Update teleconsultation ID for navigation if a real one was created
    if (createdTcId) {
      setRealTcId(createdTcId);
    }
    dismissIncomingCall();
  };

  const handleReject = async () => {
    // For emergency calls: refuse via backend (timer continues, notification resent in 20s)
    if (incomingCall.isEmergency && emergencyEventId) {
      try {
        await api.post(`/emergency-calls/${emergencyEventId}/refuse`);
      } catch (err) {
        console.error('[IncomingCallHandler] Refuse failed:', err);
      }
      dismissEmergency();
    }
    dismissIncomingCall();
  };

  // Use the real teleconsultation ID if available, otherwise fall back
  const effectiveTcId = realTcId || incomingCall.teleconsultationId;

  return (
    <IncomingCallGlobal
      callerName={incomingCall.callerName}
      callerRole={incomingCall.callerRole}
      teleconsultationId={effectiveTcId}
      isEmergency={incomingCall.isEmergency || false}
      onAccept={handleAccept}
      onReject={handleReject}
    />
  );
}
