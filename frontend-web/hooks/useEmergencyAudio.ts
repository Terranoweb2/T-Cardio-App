import { useRef, useCallback } from 'react';

/**
 * Hook for playing an insistent emergency alarm sound + vibration
 * Used on the doctor's side for paid emergency calls.
 *
 * Sound design: harsher than IncomingCallModal's gentle 440/480Hz sine waves.
 * Uses square+sawtooth waveforms at higher frequencies with faster on/off pattern.
 */
export function useEmergencyAudio() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playingRef = useRef(false);
  const vibrationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startEmergencySound = useCallback(() => {
    if (playingRef.current) return;
    playingRef.current = true;

    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;

      const playAlarm = () => {
        if (!playingRef.current || !audioCtxRef.current) return;

        // First burst — 500ms
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const osc3 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'square';
        osc1.frequency.value = 880;  // A5 — urgent
        osc2.type = 'square';
        osc2.frequency.value = 660;  // E5 — dissonant interval
        osc3.type = 'sawtooth';
        osc3.frequency.value = 1320; // High harmonic

        gain.gain.value = 0.2;

        osc1.connect(gain);
        osc2.connect(gain);
        osc3.connect(gain);
        gain.connect(ctx.destination);

        osc1.start();
        osc2.start();
        osc3.start();

        // Burst 1: 500ms on
        setTimeout(() => {
          try { osc1.stop(); osc2.stop(); osc3.stop(); } catch {}

          if (!playingRef.current) return;

          // 300ms pause, then burst 2
          setTimeout(() => {
            if (!playingRef.current || !audioCtxRef.current) return;

            const o1 = ctx.createOscillator();
            const o2 = ctx.createOscillator();
            const g = ctx.createGain();

            o1.type = 'square';
            o1.frequency.value = 880;
            o2.type = 'square';
            o2.frequency.value = 660;
            g.gain.value = 0.2;

            o1.connect(g);
            o2.connect(g);
            g.connect(ctx.destination);

            o1.start();
            o2.start();

            // Burst 2: 500ms on
            setTimeout(() => {
              try { o1.stop(); o2.stop(); } catch {}

              // 700ms pause, then loop
              setTimeout(() => playAlarm(), 700);
            }, 500);
          }, 300);
        }, 500);
      };

      playAlarm();

      // Vibration loop for mobile browsers
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        const vibrateLoop = () => {
          if (!playingRef.current) return;
          navigator.vibrate([200, 100, 200, 100, 400]);
        };
        vibrateLoop();
        vibrationIntervalRef.current = setInterval(vibrateLoop, 2000);
      }
    } catch (err) {
      console.warn('Failed to start emergency audio:', err);
    }
  }, []);

  const stopEmergencySound = useCallback(() => {
    playingRef.current = false;

    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch {}
      audioCtxRef.current = null;
    }

    if (vibrationIntervalRef.current) {
      clearInterval(vibrationIntervalRef.current);
      vibrationIntervalRef.current = null;
    }

    // Cancel any ongoing vibration
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(0);
    }
  }, []);

  return { startEmergencySound, stopEmergencySound };
}
