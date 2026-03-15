'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useNotificationStore } from '@/stores/notificationStore';
import api from '@/lib/api';

export default function NotificationBell() {
  const router = useRouter();
  const { notifications, unreadCount, markAsRead, markAllAsRead, setNotifications } =
    useNotificationStore();
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    api.get('/notifications?limit=20')
      .then((r) => {
        const data = r.data.data || r.data || [];
        setNotifications(
          data.map((a: any) => ({
            id: a.id,
            type: a.type || 'SYSTEM',
            title: a.title || a.type,
            message: a.message,
            severity: a.severity,
            isRead: a.isRead,
            createdAt: a.createdAt,
            patientId: a.patientId,
          }))
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBellClick = () => {
    // On mobile, navigate directly to notifications page
    if (isMobile) {
      router.push('/notifications');
      return;
    }
    // On desktop, toggle dropdown
    setOpen(!open);
  };

  const handleMarkRead = (id: string) => {
    markAsRead(id);
    api.patch(`/notifications/${id}/read`).catch(() => {});
  };

  const handleMarkAllRead = () => {
    markAllAsRead();
    api.patch('/notifications/read-all').catch(() => {});
  };

  const recentNotifications = notifications.slice(0, 5);

  const severityColor = (severity?: string) => {
    switch (severity) {
      case 'CRITIQUE': return 'border-l-red-500';
      case 'ELEVE': return 'border-l-red-400';
      case 'MODERE': return 'border-l-amber-500';
      default: return 'border-l-cyan-400';
    }
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'EMERGENCY':
        return <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /></svg>;
      case 'AI_RISK':
        return <svg className="w-4 h-4 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>;
      case 'THRESHOLD':
        return <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /></svg>;
      default:
        return <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>;
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleBellClick}
        className="relative p-2 rounded-lg text-slate-400 hover:bg-cyan-500/10 hover:text-cyan-400 transition"
        title="Notifications"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && !isMobile && (
        <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-80 glass-card rounded-xl z-50 overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 border-b border-cyan-500/10">
            <h3 className="text-sm font-semibold text-slate-200">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-cyan-400 hover:text-cyan-300"
              >
                Tout marquer lu
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto dark-scrollbar">
            {recentNotifications.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                Aucune notification
              </div>
            ) : (
              recentNotifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleMarkRead(n.id)}
                  className={`w-full text-left px-4 py-3 border-b border-cyan-500/5 hover:bg-cardio-700/30 transition border-l-4 ${severityColor(n.severity)} ${
                    !n.isRead ? 'bg-cyan-500/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0">{typeIcon(n.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium ${!n.isRead ? 'text-slate-200' : 'text-slate-400'}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{n.message}</p>
                      <p className="text-[10px] text-slate-600 mt-1">
                        {new Date(n.createdAt).toLocaleString('fr-FR')}
                      </p>
                    </div>
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-cyan-400 mt-1 shrink-0" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          <a
            href="/notifications"
            className="block text-center text-xs text-cyan-400 hover:text-cyan-300 py-3 border-t border-cyan-500/10"
          >
            Voir toutes les notifications
          </a>
        </div>
      )}
    </div>
  );
}
