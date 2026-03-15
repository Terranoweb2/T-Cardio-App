'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useNotificationStore } from '@/stores/notificationStore';

export default function NotificationsPage() {
 const { markAsRead, markAllAsRead } = useNotificationStore();
 const [notifications, setNotifications] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [filter, setFilter] = useState('ALL');

 useEffect(() => {
  api.get('/notifications?limit=50')
   .then((r) => setNotifications(r.data.data || r.data || []))
   .catch(() => {})
   .finally(() => setLoading(false));
 }, []);

 const handleMarkRead = async (id: string) => {
  markAsRead(id);
  await api.patch(`/notifications/${id}/read`).catch(() => {});
  setNotifications((prev) =>
   prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
  );
 };

 const handleMarkAllRead = async () => {
  markAllAsRead();
  await api.patch('/notifications/read-all').catch(() => {});
  setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
 };

 const filtered = filter === 'ALL'
  ? notifications
  : filter === 'UNREAD'
  ? notifications.filter((n) => !n.isRead)
  : notifications.filter((n) => n.type === filter);

 const severityBadge = (severity?: string) => {
  const colors: Record<string, string> = {
   CRITIQUE: 'bg-red-500/15 text-red-400',
   ELEVE: 'bg-red-500/10 text-red-400',
   MODERE: 'bg-amber-500/10 text-amber-400',
   FAIBLE: 'bg-green-500/10 text-green-400',
  };
  return severity ? (
   <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[severity] || 'bg-cardio-800'}`}>
    {severity}
   </span>
  ) : null;
 };

 const typeIcon = (type: string) => {
  switch (type) {
   case 'EMERGENCY': return '🚨';
   case 'AI_RISK': return '🤖';
   case 'THRESHOLD': return '⚠️';
   default: return '🔔';
  }
 };

 return (
  <div>
   <div className="flex justify-between items-center mb-6">
    <h1 className="text-lg sm:text-2xl font-bold">Notifications</h1>
    <button
     onClick={handleMarkAllRead}
     className="text-sm text-cyan-400 hover:text-cyan-300"
    >
     Tout marquer comme lu
    </button>
   </div>

   {/* Filters */}
   <div className="flex gap-2 mb-6 flex-wrap">
    {[
     { key: 'ALL', label: 'Toutes' },
     { key: 'UNREAD', label: 'Non lues' },
     { key: 'EMERGENCY', label: 'Urgences' },
     { key: 'AI_RISK', label: 'Alertes risque' },
     { key: 'SYSTEM', label: 'Systeme' },
    ].map((f) => (
     <button
      key={f.key}
      onClick={() => setFilter(f.key)}
      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
       filter === f.key
        ? 'glow-btn'
        : 'glass-card border border-cyan-500/10 text-slate-400 hover:bg-cardio-800/50'
      }`}
     >
      {f.label}
     </button>
    ))}
   </div>

   {/* Notifications list */}
   {loading ? (
    <div className="glass-card rounded-xl p-12 text-center text-slate-500">
     Chargement...
    </div>
   ) : filtered.length === 0 ? (
    <div className="glass-card rounded-xl p-12 text-center text-slate-500">
     Aucune notification
    </div>
   ) : (
    <div className="space-y-2">
     {filtered.map((n: any) => (
      <div
       key={n.id}
       onClick={() => !n.isRead && handleMarkRead(n.id)}
       className={`glass-card rounded-xl p-4 flex items-start gap-3 cursor-pointer transition hover: ${
        !n.isRead ? 'border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'
       }`}
      >
       <span className="text-lg mt-0.5">{typeIcon(n.type)}</span>
       <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
         <p className={`text-sm font-medium ${!n.isRead ? 'text-slate-100' : 'text-slate-400'}`}>
          {n.title || n.type}
         </p>
         {severityBadge(n.severity)}
        </div>
        <p className="text-sm text-slate-400">{n.message}</p>
        <p className="text-xs text-slate-500 mt-1">
         {new Date(n.createdAt).toLocaleString('fr-FR')}
        </p>
       </div>
       {!n.isRead && (
        <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 mt-1.5 shrink-0" />
       )}
      </div>
     ))}
    </div>
   )}
  </div>
 );
}
