import { create } from 'zustand';

/** Play notification sound (fire-and-forget) */
function playNotificationSound() {
  if (typeof window === 'undefined') return;
  try {
    const audio = new Audio('/notification_message.mp3');
    audio.volume = 0.7;
    audio.play().catch(() => {});
  } catch {}
}

export interface Notification {
  id: string;
  type: 'EMERGENCY' | 'AI_RISK' | 'THRESHOLD' | 'SYSTEM' | 'INFO';
  title: string;
  message: string;
  severity?: string;
  isRead: boolean;
  createdAt: string;
  patientId?: string;
  patientName?: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  showEmergencyBanner: boolean;
  emergencyMessage: string;
  emergencyTeleconsultationId: string | null;
  emergencyEventId: string | null;
  emergencyType: 'free' | 'paid' | null;

  addNotification: (notification: Notification) => void;
  setNotifications: (notifications: Notification[]) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismissEmergency: () => void;
  triggerEmergency: (message: string, teleconsultationId?: string, emergencyType?: 'free' | 'paid', eventId?: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  showEmergencyBanner: false,
  emergencyMessage: '',
  emergencyTeleconsultationId: null,
  emergencyEventId: null,
  emergencyType: null,

  addNotification: (notification) =>
    set((state) => {
      const exists = state.notifications.some((n) => n.id === notification.id);
      if (exists) return state;

      // Play notification sound for new notifications
      playNotificationSound();

      const newNotifications = [notification, ...state.notifications].slice(0, 50);
      const newUnread = newNotifications.filter((n) => !n.isRead).length;

      return {
        notifications: newNotifications,
        unreadCount: newUnread,
        // Auto-show emergency banner for EMERGENCY type
        showEmergencyBanner: notification.type === 'EMERGENCY' ? true : state.showEmergencyBanner,
        emergencyMessage: notification.type === 'EMERGENCY' ? notification.message : state.emergencyMessage,
      };
    }),

  setNotifications: (notifications) =>
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.isRead).length,
    }),

  markAsRead: (id) =>
    set((state) => {
      const updated = state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      );
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.isRead).length,
      };
    }),

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    })),

  dismissEmergency: () =>
    set({ showEmergencyBanner: false, emergencyMessage: '', emergencyTeleconsultationId: null, emergencyEventId: null, emergencyType: null }),

  triggerEmergency: (message, teleconsultationId?, emergencyType?, eventId?) =>
    set({ showEmergencyBanner: true, emergencyMessage: message, emergencyTeleconsultationId: teleconsultationId || null, emergencyEventId: eventId || null, emergencyType: emergencyType || 'free' }),
}));
