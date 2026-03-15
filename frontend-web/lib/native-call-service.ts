/**
 * Native Call Service Bridge
 *
 * Bridges the frontend JavaScript layer with the native Android
 * CallNotificationService via the TokenBridge Capacitor plugin.
 *
 * - On login: sends JWT + userId + role to native service → starts persistent WebSocket
 * - On logout: stops the native service and clears stored credentials
 *
 * Only active on native Android platform (Capacitor). No-op in browser.
 */

let TokenBridge: any = null;
let bridgeInitialized = false;

/**
 * Initialize the TokenBridge plugin at runtime.
 * Uses eval to prevent Webpack from bundling Capacitor core.
 */
function initBridge(): boolean {
  if (bridgeInitialized) return TokenBridge !== null;

  try {
    // eslint-disable-next-line no-eval
    const capacitorCore = eval(`require('@capacitor/core')`);
    if (capacitorCore?.Capacitor?.isNativePlatform()) {
      TokenBridge = capacitorCore.registerPlugin('TokenBridge');
      bridgeInitialized = true;
      console.log('[NativeCallService] TokenBridge plugin loaded');
      return true;
    }
  } catch {
    // Not on native platform or plugin not available
  }

  bridgeInitialized = true;
  return false;
}

/**
 * Start the native call notification service.
 * Called after successful login with JWT token.
 *
 * @param token - JWT authentication token
 * @param userId - The logged-in user's ID
 * @param role - The user's role (PATIENT, DOCTOR, ADMIN)
 */
export async function startNativeCallService(
  token: string,
  userId: string,
  role: string,
): Promise<void> {
  if (!initBridge() || !TokenBridge) return;

  try {
    await TokenBridge.setToken({ token, userId, role });
    console.log('[NativeCallService] Service started for', role, userId);
  } catch (err) {
    console.warn('[NativeCallService] Failed to start service:', err);
  }
}

/**
 * Stop the native call notification service.
 * Called on logout.
 */
export async function stopNativeCallService(): Promise<void> {
  if (!initBridge() || !TokenBridge) return;

  try {
    await TokenBridge.stopService();
    console.log('[NativeCallService] Service stopped');
  } catch (err) {
    console.warn('[NativeCallService] Failed to stop service:', err);
  }
}
