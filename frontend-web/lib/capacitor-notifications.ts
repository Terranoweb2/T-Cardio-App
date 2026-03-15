import { Capacitor } from '@capacitor/core';

let LocalNotifications: any = null;

async function getLocalNotifications() {
  if (!Capacitor.isNativePlatform()) return null;
  if (LocalNotifications) return LocalNotifications;
  try {
    const mod = await import('@capacitor/local-notifications');
    LocalNotifications = mod.LocalNotifications;
    return LocalNotifications;
  } catch {
    return null;
  }
}

export async function initCapacitorNotifications(): Promise<void> {
  const LN = await getLocalNotifications();
  if (!LN) return;

  const { display } = await LN.requestPermissions();
  if (display !== 'granted') {
    console.log('[capacitor] Notification permission denied');
    return;
  }

  // Listen to notification clicks
  LN.addListener('localNotificationActionPerformed', (notification: any) => {
    const data = notification.notification?.extra || {};
    if (data.type === 'call' && data.teleconsultationId) {
      window.location.href = `/teleconsultations/${data.teleconsultationId}?autoAccept=true`;
    } else if (data.type === 'missed_call' && data.teleconsultationId) {
      window.location.href = `/teleconsultations/${data.teleconsultationId}`;
    } else if (data.type === 'message' && data.conversationId) {
      window.location.href = `/messaging?conversation=${data.conversationId}`;
    } else if (data.type === 'emergency') {
      window.location.href = '/notifications';
    } else if (data.type === 'reminder') {
      window.location.href = '/measurements/add';
    }
  });

  console.log('[capacitor] Local notifications initialized');
}

let notifIdCounter = 1;

export async function showLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>,
): Promise<void> {
  const LN = await getLocalNotifications();
  if (!LN) return;

  await LN.schedule({
    notifications: [
      {
        id: notifIdCounter++,
        title,
        body,
        extra: data || {},
        sound: 'notification_message.mp3',
        smallIcon: 'ic_stat_icon',
      },
    ],
  });
}

export async function showIncomingCallNotification(
  callerName: string,
  teleconsultationId: string,
): Promise<void> {
  const LN = await getLocalNotifications();
  if (!LN) return;

  await LN.schedule({
    notifications: [
      {
        id: notifIdCounter++,
        title: 'Appel entrant',
        body: `${callerName} vous appelle...`,
        extra: { type: 'call', teleconsultationId },
        sound: 'ringtone.mp3',
        ongoing: true,
        smallIcon: 'ic_stat_icon',
      },
    ],
  });
}

export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}
