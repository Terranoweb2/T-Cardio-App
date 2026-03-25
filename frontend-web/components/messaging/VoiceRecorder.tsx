'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, X, Loader2 } from 'lucide-react';

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob, duration: number) => void;
  disabled?: boolean;
}

type RecordingState = 'idle' | 'requesting' | 'recording' | 'error';

const MAX_DURATION = 120; // seconds

export default function VoiceRecorder({ onRecordingComplete, disabled = false }: VoiceRecorderProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      cleanupStream();
    };
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    setErrorMessage('');
    setState('requesting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Determine supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        const blob = new Blob(chunksRef.current, { type: mimeType });
        cleanupStream();

        if (blob.size > 0 && duration > 0) {
          onRecordingComplete(blob, duration);
        }

        chunksRef.current = [];
        setState('idle');
        setElapsed(0);
      };

      recorder.onerror = () => {
        setState('error');
        setErrorMessage('Erreur lors de l\'enregistrement.');
        cleanupStream();
        stopTimer();
      };

      recorder.start(250); // collect data every 250ms
      startTimeRef.current = Date.now();
      setState('recording');
      setElapsed(0);

      // Start elapsed timer
      timerRef.current = setInterval(() => {
        const secs = Math.round((Date.now() - startTimeRef.current) / 1000);
        setElapsed(secs);

        // Auto-stop at max duration
        if (secs >= MAX_DURATION) {
          stopRecording();
        }
      }, 500);
    } catch (err: any) {
      setState('error');
      cleanupStream();

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Acces au microphone refuse. Veuillez autoriser l\'acces dans les parametres de votre navigateur.');
      } else if (err.name === 'NotFoundError') {
        setErrorMessage('Aucun microphone detecte sur cet appareil.');
      } else {
        setErrorMessage('Impossible d\'acceder au microphone.');
      }
    }
  }, [onRecordingComplete, cleanupStream, stopTimer]);

  const stopRecording = useCallback(() => {
    stopTimer();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, [stopTimer]);

  const cancelRecording = useCallback(() => {
    stopTimer();

    // Prevent onstop from firing the callback
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
    }

    chunksRef.current = [];
    cleanupStream();
    setState('idle');
    setElapsed(0);
  }, [cleanupStream, stopTimer]);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Error state
  if (state === 'error') {
    return (
      <div className="flex items-center gap-2">
        <div className="glass-card rounded-full px-4 py-2 flex items-center gap-2 border border-red-500/30">
          <p className="text-xs text-red-400 max-w-[200px]">{errorMessage}</p>
          <button
            onClick={() => {
              setState('idle');
              setErrorMessage('');
            }}
            className="p-1 rounded-full hover:bg-red-500/10 transition text-red-400"
            aria-label="Fermer l'erreur"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <button
          onClick={startRecording}
          disabled={disabled}
          className="w-10 h-10 rounded-full bg-cardio-700/60 border border-cardio-600/40 flex items-center justify-center text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Reessayer l'enregistrement"
        >
          <Mic className="w-5 h-5" />
        </button>
      </div>
    );
  }

  // Requesting mic permission
  if (state === 'requesting') {
    return (
      <div className="flex items-center gap-2">
        <button
          disabled
          className="w-10 h-10 rounded-full bg-cardio-700/60 border border-cardio-600/40 flex items-center justify-center text-cyan-400"
          aria-label="Demande de permission en cours"
        >
          <Loader2 className="w-5 h-5 animate-spin" />
        </button>
      </div>
    );
  }

  // Recording state
  if (state === 'recording') {
    const progress = (elapsed / MAX_DURATION) * 100;

    return (
      <div className="flex items-center gap-2">
        {/* Cancel button */}
        <button
          onClick={cancelRecording}
          className="w-8 h-8 rounded-full bg-cardio-800/80 border border-cardio-600/30 flex items-center justify-center text-slate-400 hover:text-red-400 hover:border-red-500/30 transition-all"
          aria-label="Annuler l'enregistrement"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Waveform + timer */}
        <div className="glass-card rounded-full px-3 py-1.5 flex items-center gap-2 border border-red-500/30 bg-red-500/5">
          {/* Pulsing red dot */}
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />

          {/* Waveform bars */}
          <div className="flex items-center gap-[2px] h-5" aria-hidden="true">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="w-[3px] rounded-full bg-red-400/80"
                style={{
                  animation: `voice-bar ${0.4 + (i % 4) * 0.15}s ease-in-out ${i * 0.05}s infinite alternate`,
                  height: '4px',
                }}
              />
            ))}
          </div>

          {/* Timer */}
          <span className="text-xs font-mono text-red-400 tabular-nums min-w-[40px] text-center">
            {formatTime(elapsed)}
          </span>

          {/* Progress bar (subtle) */}
          <div className="w-12 h-1 rounded-full bg-cardio-700/60 overflow-hidden">
            <div
              className="h-full bg-red-500/60 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Stop button */}
        <button
          onClick={stopRecording}
          className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center text-white transition-all shadow-lg shadow-red-600/25 hover:scale-105"
          aria-label="Arreter l'enregistrement"
        >
          <Square className="w-4 h-4" fill="currentColor" />
        </button>

        {/* CSS keyframes for waveform animation */}
        <style jsx>{`
          @keyframes voice-bar {
            0% {
              height: 4px;
            }
            100% {
              height: 18px;
            }
          }
        `}</style>
      </div>
    );
  }

  // Idle state: mic button
  return (
    <button
      onClick={startRecording}
      disabled={disabled}
      className="w-10 h-10 rounded-full bg-cardio-700/60 border border-cardio-600/40 flex items-center justify-center text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 hover:bg-cyan-500/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      aria-label="Enregistrer un message vocal"
      title="Message vocal"
    >
      <Mic className="w-5 h-5" />
    </button>
  );
}
