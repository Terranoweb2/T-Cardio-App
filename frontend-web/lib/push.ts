import api from './api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('[push] Service Worker registered');
    return registration;
  } catch (err) {
    console.warn('[push] Service Worker registration failed:', err);
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPush(registration: ServiceWorkerRegistration): Promise<boolean> {
  try {
    // Check if already subscribed
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      // Re-send to backend in case it was lost
      await sendSubscriptionToServer(existing);
      console.log('[push] Already subscribed, re-synced with server');
      return true;
    }

    // Get VAPID public key from backend
    const { data } = await api.get('/push/vapid-key');
    if (!data.publicKey) {
      console.warn('[push] No VAPID key available from server');
      return false;
    }

    const applicationServerKey = urlBase64ToUint8Array(data.publicKey);

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
    });

    await sendSubscriptionToServer(subscription);
    console.log('[push] Push subscription created and sent to server');
    return true;
  } catch (err) {
    console.warn('[push] Push subscription failed:', err);
    return false;
  }
}

async function sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON();
  await api.post('/push/subscribe', {
    endpoint: json.endpoint,
    keys: {
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    },
  });
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await api.post('/push/unsubscribe', { endpoint }).catch(() => {});
    console.log('[push] Unsubscribed from push');
  }
}

/**
 * Full initialization: register SW + subscribe to push.
 * Call this once after user is authenticated.
 */
export async function initPush(): Promise<void> {
  if (!isPushSupported()) return;
  if (typeof window !== 'undefined' && localStorage.getItem('pushRegistered') === 'true') {
    // Already registered — just ensure SW is active
    const reg = await registerServiceWorker();
    if (reg) await subscribeToPush(reg);
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.log('[push] Notification permission denied');
    return;
  }

  const reg = await registerServiceWorker();
  if (!reg) return;

  const ok = await subscribeToPush(reg);
  if (ok && typeof window !== 'undefined') {
    localStorage.setItem('pushRegistered', 'true');
  }
}
