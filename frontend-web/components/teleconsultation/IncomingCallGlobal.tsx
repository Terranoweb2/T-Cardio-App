'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface IncomingCallGlobalProps {
  callerName: string;
  callerRole: string;
  teleconsultationId: string;
  onAccept: () => void;
  onReject: () => void;
  isEmergency?: boolean;
}

/**
 * Global incoming call modal — displayed at the layout level.
 * When the user accepts, they are redirected to the teleconsultation page.
 * Plays /ringtone.mp3 in loop for incoming call sound.
 */
export default function IncomingCallGlobal({
  callerName,
  callerRole,
  teleconsultationId,
  onAccept,
  onReject,
  isEmergency = false,
}: IncomingCallGlobalProps) {
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Play ringtone MP3 in loop
  useEffect(() => {
    const audio = new Audio('/ringtone.mp3');
    audio.loop = true;
    audio.volume = 1.0;
    audioRef.current = audio;

    // Try to play (may need user interaction on some browsers)
    audio.play().catch(() => {
      // Autoplay blocked — retry on next user interaction
      const tryPlay = () => {
        audio.play().catch(() => {});
        document.removeEventListener('touchstart', tryPlay);
        document.removeEventListener('click', tryPlay);
      };
      document.addEventListener('touchstart', tryPlay, { once: true });
      document.addEventListener('click', tryPlay, { once: true });
    });

    // Also try to vibrate on mobile
    let vibrating = true;
    if (navigator.vibrate) {
      const vibratePattern = () => {
        if (!vibrating) return;
        navigator.vibrate([500, 300, 500, 300, 500]);
        setTimeout(vibratePattern, 3000);
      };
      vibratePattern();
    }

    return () => {
      vibrating = false;
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
      if (navigator.vibrate) navigator.vibrate(0);
    };
  }, []);

  const stopRingtone = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (navigator.vibrate) navigator.vibrate(0);
  }, []);

  const handleAccept = useCallback(async () => {
    stopRingtone();
    await onAccept();
    router.push(`/teleconsultations/${teleconsultationId}?autoAccept=true`);
  }, [onAccept, router, teleconsultationId, stopRingtone]);

  const handleReject = useCallback(async () => {
    stopRingtone();
    await onReject();
  }, [onReject, stopRingtone]);

  const roleLabel = callerRole === 'PATIENT' ? 'Patient'
    : callerRole === 'CARDIOLOGUE' ? 'Cardiologue'
    : 'Medecin';

  return (
    <div className={`fixed inset-0 z-[200] flex items-center justify-center backdrop-blur-md animate-fadeIn ${isEmergency ? 'bg-red-900/85' : 'bg-black/80'}`}>
      <div className={`rounded-3xl shadow-2xl p-6 sm:p-8 max-w-sm mx-4 text-center border w-full ${isEmergency ? 'bg-gradient-to-b from-red-800 to-red-950 border-red-500/50' : 'bg-gradient-to-b from-gray-800 to-gray-900 border-cyan-500/20'}`}>
        {/* Header */}
        {isEmergency ? (
          <div className="mb-4">
            <span className="inline-block bg-red-600 text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full animate-pulse mb-2">&#x1F6A8; URGENCE</span>
            <p className="text-red-300 text-xs uppercase tracking-wider">Appel d&apos;urgence entrant</p>
          </div>
        ) : (
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-4">Appel entrant</p>
        )}

        {/* Pulsing avatar */}
        <div className="relative inline-flex mb-5">
          <div className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center relative z-10 shadow-lg ${isEmergency ? 'bg-gradient-to-br from-red-500 to-red-700 shadow-red-500/30' : 'bg-gradient-to-br from-green-500 to-green-700 shadow-green-500/30'}`}>
            {callerRole === 'PATIENT' ? (
              <svg className="w-12 h-12 sm:w-14 sm:h-14 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            ) : (
              <svg className="w-12 h-12 sm:w-14 sm:h-14 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5.25 14.25m0 0l3.841 3.841a2.25 2.25 0 001.591.659h5.714M5.25 14.25h14.5M19.5 10.5V6.75a2.25 2.25 0 00-2.25-2.25h-1.372c-.516 0-1.009.205-1.372.569L12.75 6.75" />
              </svg>
            )}
          </div>
          {/* Pulsing rings */}
          <div className={`absolute inset-0 w-24 h-24 sm:w-28 sm:h-28 rounded-full animate-ping ${isEmergency ? 'bg-red-500/30' : 'bg-green-500/30'}`} />
          <div className={`absolute inset-[-10px] w-[calc(6rem+20px)] sm:w-[calc(7rem+20px)] h-[calc(6rem+20px)] sm:h-[calc(7rem+20px)] rounded-full animate-pulse ${isEmergency ? 'bg-red-500/10' : 'bg-green-500/10'}`} />
        </div>

        {/* Caller info */}
        <h3 className="text-white text-xl sm:text-2xl font-bold mb-1">{callerName}</h3>
        <p className="text-slate-400 text-sm mb-1">{roleLabel}</p>
        <p className="text-green-400 text-xs mb-8 flex items-center justify-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9.75a2.25 2.25 0 002.25-2.25V7.5a2.25 2.25 0 00-2.25-2.25H4.5A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
          </svg>
          Teleconsultation video
        </p>

        {/* Action buttons */}
        <div className="flex justify-center gap-8">
          {/* Reject */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleReject}
              className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-all shadow-lg shadow-red-600/40 hover:scale-110 active:scale-95"
              title="Refuser"
            >
              <svg className="w-7 h-7 rotate-[135deg]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
            </button>
            <span className="text-slate-400 text-xs">Refuser</span>
          </div>

          {/* Accept */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleAccept}
              className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-green-600 hover:bg-green-500 text-white flex items-center justify-center transition-all shadow-lg shadow-green-600/40 hover:scale-110 active:scale-95"
              title="Accepter"
            >
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9.75a2.25 2.25 0 002.25-2.25V7.5a2.25 2.25 0 00-2.25-2.25H4.5A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </button>
            <span className="text-slate-400 text-xs">Accepter</span>
          </div>
        </div>
      </div>
    </div>
  );
}
