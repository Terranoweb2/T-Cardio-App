'use client';

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

  if (!incomingCall) return null;

  // Don't show global modal if user is already on this teleconsultation's detail page
  // The VideoCall component now handles incoming calls via SocketContext directly
  const isOnTeleconsultationPage = pathname === `/teleconsultations/${incomingCall.teleconsultationId}`;
  if (isOnTeleconsultationPage) return null;

  const handleAccept = async () => {
    // For emergency calls: call backend to acknowledge (stops all notifications)
    if (incomingCall.isEmergency && emergencyEventId && emergencyTeleconsultationId) {
      try {
        await api.post(`/teleconsultations/${emergencyTeleconsultationId}/emergency/${emergencyEventId}/acknowledge`);
      } catch (err) {
        console.error('[IncomingCallHandler] Acknowledge failed:', err);
      }
      dismissEmergency();
    }
    dismissIncomingCall();
    // Navigation happens inside IncomingCallGlobal
  };

  const handleReject = async () => {
    // For emergency calls: call backend to refuse (timer continues, notification resent in 20s)
    if (incomingCall.isEmergency && emergencyEventId && emergencyTeleconsultationId) {
      try {
        await api.post(`/teleconsultations/${emergencyTeleconsultationId}/emergency/${emergencyEventId}/refuse`);
      } catch (err) {
        console.error('[IncomingCallHandler] Refuse failed:', err);
      }
      dismissEmergency();
    }
    dismissIncomingCall();
  };

  return (
    <IncomingCallGlobal
      callerName={incomingCall.callerName}
      callerRole={incomingCall.callerRole}
      teleconsultationId={incomingCall.teleconsultationId}
      isEmergency={incomingCall.isEmergency || false}
      onAccept={handleAccept}
      onReject={handleReject}
    />
  );
}
