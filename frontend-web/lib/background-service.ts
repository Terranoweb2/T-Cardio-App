/**
 * Background Service for T-Cardio Pro
 *
 * Keeps the app active during teleconsultation calls:
 * - WakeLock API to prevent screen sleep during calls (browser + WebView)
 * - Capacitor foreground service support (loaded dynamically at runtime only)
 *
 * Note: Capacitor plugins (@capawesome/capacitor-android-foreground-service,
 * @capacitor-community/keep-awake) are loaded via require() at runtime only
 * when they are installed. They are NOT bundled by Webpack/Next.js.
 */

let foregroundServiceRunning = false;
let keepAwakeActive = false;
let wakeLockSentinel: any = null;

/**
 * Try to load a module at runtime without failing the build
 * Uses eval to prevent Webpack from resolving the require
 */
function tryRequire(moduleName: string): any | null {
  try {
    // Use eval to bypass Webpack static analysis
    // eslint-disable-next-line no-eval
    return eval(`require('${moduleName}')`);
  } catch {
    return null;
  }
}

/**
 * Start foreground service for active call
 */
export async function startCallForegroundService(): Promise<void> {
  if (foregroundServiceRunning && keepAwakeActive) return;

  // Try Android foreground service (only works in native Capacitor builds)
  if (!foregroundServiceRunning) {
    const capCore = tryRequire('@capacitor/core');
    if (capCore?.Capacitor?.isNativePlatform() && capCore.Capacitor.getPlatform() === 'android') {
      const fgMod = tryRequire('@capawesome/capacitor-android-foreground-service');
      if (fgMod?.ForegroundService) {
        try {
          await fgMod.ForegroundService.startForegroundService({
            id: 1001,
            title: 'T-Cardio Pro',
            body: 'Appel en cours...',
            smallIcon: 'ic_stat_icon',
          });
          foregroundServiceRunning = true;
          console.log('[BackgroundService] Foreground service started');
        } catch (err) {
          console.warn('[BackgroundService] Foreground service error:', err);
        }
      }
    }
  }

  // Keep screen awake
  if (!keepAwakeActive) {
    // Try native KeepAwake plugin
    const capCore = tryRequire('@capacitor/core');
    if (capCore?.Capacitor?.isNativePlatform()) {
      const keepAwakeMod = tryRequire('@capacitor-community/keep-awake');
      if (keepAwakeMod?.KeepAwake) {
        try {
          await keepAwakeMod.KeepAwake.keepAwake();
          keepAwakeActive = true;
          console.log('[BackgroundService] Keep-awake enabled (native)');
        } catch {
          // fall through to WakeLock
        }
      }
    }

    // Fallback: WakeLock API (modern browsers + Android WebView)
    if (!keepAwakeActive && typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
        keepAwakeActive = true;
        console.log('[BackgroundService] WakeLock API enabled');

        wakeLockSentinel.addEventListener('release', () => {
          console.log('[BackgroundService] WakeLock released');
          keepAwakeActive = false;
          wakeLockSentinel = null;
        });
      } catch {
        console.log('[BackgroundService] WakeLock not available');
      }
    }
  }
}

/**
 * Stop foreground service when call ends
 */
export async function stopCallForegroundService(): Promise<void> {
  if (!foregroundServiceRunning && !keepAwakeActive) return;

  // Stop foreground service
  if (foregroundServiceRunning) {
    const fgMod = tryRequire('@capawesome/capacitor-android-foreground-service');
    if (fgMod?.ForegroundService) {
      try {
        await fgMod.ForegroundService.stopForegroundService();
        console.log('[BackgroundService] Foreground service stopped');
      } catch {
        // ignore
      }
    }
    foregroundServiceRunning = false;
  }

  // Release keep-awake
  if (keepAwakeActive) {
    // Release WakeLock
    if (wakeLockSentinel) {
      try {
        await wakeLockSentinel.release();
        wakeLockSentinel = null;
        console.log('[BackgroundService] WakeLock released');
      } catch {
        // ignore
      }
    }

    // Release native keep-awake
    const keepAwakeMod = tryRequire('@capacitor-community/keep-awake');
    if (keepAwakeMod?.KeepAwake) {
      try {
        await keepAwakeMod.KeepAwake.allowSleep();
        console.log('[BackgroundService] Keep-awake released (native)');
      } catch {
        // ignore
      }
    }

    keepAwakeActive = false;
  }
}
