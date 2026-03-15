'use client';

import { useEffect, useRef, useCallback } from 'react';

interface IncomingCallModalProps {
  callerName: string;
  onAccept: () => void;
  onReject: () => void;
}

export default function IncomingCallModal({ callerName, onAccept, onReject }: IncomingCallModalProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Play ringtone MP3 in loop
  useEffect(() => {
    const audio = new Audio('/ringtone.mp3');
    audio.loop = true;
    audio.volume = 1.0;
    audioRef.current = audio;

    audio.play().catch(() => {
      const tryPlay = () => {
        audio.play().catch(() => {});
        document.removeEventListener('touchstart', tryPlay);
        document.removeEventListener('click', tryPlay);
      };
      document.addEventListener('touchstart', tryPlay, { once: true });
      document.addEventListener('click', tryPlay, { once: true });
    });

    return () => {
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    };
  }, []);

  const stopRingtone = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-gray-900 rounded-2xl shadow-2xl p-8 max-w-sm mx-4 text-center border border-gray-700">
        {/* Pulsing avatar */}
        <div className="relative inline-flex mb-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center relative z-10">
            <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          {/* Pulsing rings */}
          <div className="absolute inset-0 w-24 h-24 rounded-full bg-cyan-500/30 animate-ping" />
          <div className="absolute inset-[-8px] w-[calc(6rem+16px)] h-[calc(6rem+16px)] rounded-full bg-cyan-500/15 animate-pulse" />
        </div>

        <h3 className="text-white text-xl font-bold mb-1">Appel entrant</h3>
        <p className="text-slate-400 text-sm mb-8">{callerName}</p>

        <div className="flex justify-center gap-6">
          {/* Reject */}
          <button
            onClick={() => { stopRingtone(); onReject(); }}
            className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-all shadow-lg shadow-red-600/30 hover:scale-105"
            title="Refuser"
          >
            <svg className="w-7 h-7 rotate-[135deg]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
          </button>

          {/* Accept */}
          <button
            onClick={() => { stopRingtone(); onAccept(); }}
            className="w-16 h-16 rounded-full bg-green-600 hover:bg-green-500 text-white flex items-center justify-center transition-all shadow-lg shadow-green-600/30 hover:scale-105"
            title="Accepter"
          >
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9.75a2.25 2.25 0 002.25-2.25V7.5a2.25 2.25 0 00-2.25-2.25H4.5A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
