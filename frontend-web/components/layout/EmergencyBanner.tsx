'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useNotificationStore } from '@/stores/notificationStore';
import { useAuthStore } from '@/stores/authStore';
import { useEmergencyAudio } from '@/hooks/useEmergencyAudio';
import api from '@/lib/api';

export default function EmergencyBanner() {
  const {
    showEmergencyBanner,
    emergencyMessage,
    emergencyTeleconsultationId,
    emergencyEventId,
    emergencyType,
    dismissEmergency,
  } = useNotificationStore();
  const { user } = useAuthStore();
  const router = useRouter();
  const { startEmergencySound, stopEmergencySound } = useEmergencyAudio();
  const [isResponding, setIsResponding] = useState(false);

  const isDoctor = user?.role === 'MEDECIN' || user?.role === 'CARDIOLOGUE';

  // Start/stop audio based on banner visibility and emergency type
  useEffect(() => {
    if (showEmergencyBanner && emergencyType === 'paid' && isDoctor) {
      startEmergencySound();
    }
    return () => {
      stopEmergencySound();
    };
  }, [showEmergencyBanner, emergencyType, isDoctor, startEmergencySound, stopEmergencySound]);

  if (!showEmergencyBanner) return null;

  const isPaid = emergencyType === 'paid';

  // Accept emergency call (doctor) — calls new independent endpoint then navigates
  const handleAccept = async () => {
    stopEmergencySound();
    setIsResponding(true);
    try {
      if (emergencyEventId) {
        await api.post(`/emergency-calls/${emergencyEventId}/acknowledge`);
      }
    } catch (err) {
      console.error('[EmergencyBanner] Acknowledge failed:', err);
    }
    // Navigate to urgences page or teleconsultation if linked
    if (emergencyTeleconsultationId) {
      router.push(`/teleconsultations/${emergencyTeleconsultationId}?autoAccept=true`);
    } else {
      router.push('/doctor/urgences');
    }
    dismissEmergency();
    setIsResponding(false);
  };

  // Refuse emergency call (doctor) — calls new independent endpoint, timer continues
  const handleRefuse = async () => {
    stopEmergencySound();
    setIsResponding(true);
    try {
      if (emergencyEventId) {
        await api.post(`/emergency-calls/${emergencyEventId}/refuse`);
      }
    } catch (err) {
      console.error('[EmergencyBanner] Refuse failed:', err);
    }
    dismissEmergency();
    setIsResponding(false);
  };

  // Simple join (navigate without acknowledge — for free emergencies or when no eventId)
  const handleJoin = () => {
    stopEmergencySound();
    if (emergencyTeleconsultationId) {
      router.push(`/teleconsultations/${emergencyTeleconsultationId}`);
    } else {
      router.push('/doctor/urgences');
    }
    dismissEmergency();
  };

  const handleDismiss = () => {
    stopEmergencySound();
    dismissEmergency();
  };

  return (
    <div className={`fixed top-0 left-0 right-0 z-[100] text-white shadow-lg ${
      isPaid ? 'bg-red-700 animate-pulse' : 'bg-red-600'
    }`}>
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-bold text-sm">ALERTE URGENCE</p>
              {isPaid && (
                <span className="text-xs bg-white/20 rounded px-1.5 py-0.5 font-medium">INSISTANT</span>
              )}
            </div>
            <p className="text-sm opacity-90">{emergencyMessage}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDoctor && isPaid && emergencyEventId && (
            <>
              <button
                onClick={handleAccept}
                disabled={isResponding}
                className="bg-green-500 hover:bg-green-400 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition disabled:opacity-50"
              >
                Accepter
              </button>
              <button
                onClick={handleRefuse}
                disabled={isResponding}
                className="bg-red-900 hover:bg-red-800 border border-red-400/30 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition disabled:opacity-50"
              >
                Refuser
              </button>
            </>
          )}
          {isDoctor && (!isPaid || !emergencyEventId) && (
            <button
              onClick={handleJoin}
              className="bg-white text-red-600 hover:bg-red-50 px-4 py-1.5 rounded-lg text-sm font-bold transition"
            >
              Rejoindre
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-lg text-sm font-medium transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
