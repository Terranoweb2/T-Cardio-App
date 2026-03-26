'use client';

import { useState, useMemo } from 'react';
import { Clock } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import TimelineItem from './TimelineItem';

interface ActivityTimelineProps {
  notifications: any[]; // from useNotifications(50)
  patients: any[];
}

type FilterTab = 'all' | 'measures' | 'alerts' | 'teleconsultations';

const tabs: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'measures', label: 'Mesures' },
  { key: 'alerts', label: 'Alertes' },
  { key: 'teleconsultations', label: 'Teleconsultations' },
];

/**
 * Map notification type/data.type to a TimelineItem type.
 * Falls back to 'system' for unknown types.
 */
function resolveTimelineType(
  notification: any
): 'measurement' | 'alert' | 'teleconsultation' | 'system' | 'report' {
  const raw = notification.type || notification.data?.type || '';
  const normalized = raw.toLowerCase();

  if (
    normalized.includes('measure') ||
    normalized.includes('bp') ||
    normalized.includes('reading')
  ) {
    return 'measurement';
  }
  if (
    normalized.includes('alert') ||
    normalized.includes('emergency') ||
    normalized.includes('threshold') ||
    normalized.includes('risk')
  ) {
    return 'alert';
  }
  if (
    normalized.includes('teleconsult') ||
    normalized.includes('call') ||
    normalized.includes('video')
  ) {
    return 'teleconsultation';
  }
  if (normalized.includes('report')) {
    return 'report';
  }
  return 'system';
}

/**
 * Determine which filter tab a timeline type belongs to.
 */
function matchesFilter(
  timelineType: string,
  filter: FilterTab
): boolean {
  if (filter === 'all') return true;
  if (filter === 'measures') return timelineType === 'measurement';
  if (filter === 'alerts') return timelineType === 'alert';
  if (filter === 'teleconsultations') return timelineType === 'teleconsultation';
  return false;
}

/**
 * Map severity from notification to TimelineItem severity.
 */
function resolveSeverity(
  notification: any
): 'info' | 'warning' | 'critical' {
  const sev = (notification.severity || notification.data?.severity || '').toUpperCase();
  if (sev === 'CRITIQUE' || sev === 'CRITICAL') return 'critical';
  if (sev === 'ELEVE' || sev === 'MODERE' || sev === 'WARNING') return 'warning';
  return 'info';
}

/**
 * Format a date for the section header (e.g. "Aujourd'hui" or "24 mars 2026").
 */
function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return "Aujourd'hui";
  return format(date, 'dd MMMM yyyy', { locale: fr });
}

export default function ActivityTimeline({
  notifications,
  patients,
}: ActivityTimelineProps) {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  // Build a patient lookup for linking
  const patientLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of patients) {
      if (p.id && p.user?.email) {
        map.set(p.user.email, p.id);
      }
      if (p.id && p.userId) {
        map.set(p.userId, p.id);
      }
    }
    return map;
  }, [patients]);

  // Convert notifications to timeline items with metadata
  const timelineItems = useMemo(() => {
    return (notifications || [])
      .map((n: any) => {
        const type = resolveTimelineType(n);
        return {
          id: n.id,
          type,
          title: n.title || n.type || 'Notification',
          description: n.body || n.message || '',
          timestamp: n.createdAt || n.created_at || new Date().toISOString(),
          severity: resolveSeverity(n),
          patientId: n.patientId || patientLookup.get(n.userId) || undefined,
          value: n.data?.value || undefined,
        };
      })
      .sort(
        (a: any, b: any) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
  }, [notifications, patientLookup]);

  // Apply active filter
  const filtered = useMemo(
    () => timelineItems.filter((item: any) => matchesFilter(item.type, activeFilter)),
    [timelineItems, activeFilter]
  );

  // Group by date for section headers
  const grouped = useMemo(() => {
    const groups: { date: string; items: typeof filtered }[] = [];
    let currentDate = '';

    for (const item of filtered) {
      const dateKey = new Date(item.timestamp).toDateString();
      if (dateKey !== currentDate) {
        currentDate = dateKey;
        groups.push({ date: item.timestamp, items: [item] });
      } else {
        groups[groups.length - 1].items.push(item);
      }
    }

    return groups;
  }, [filtered]);

  return (
    <div className="glass-card rounded-lg">
      {/* Header */}
      <div className="px-4 py-3 border-b border-cardio-700/50">
        <h3 className="text-sm font-semibold text-slate-200">
          Activit&eacute; r&eacute;cente
        </h3>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-b border-cardio-700/50 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`text-xs px-3 py-1 rounded-full transition-colors ${
              activeFilter === tab.key
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="max-h-[500px] overflow-y-auto dark-scrollbar">
        {grouped.length > 0 ? (
          grouped.map((group) => (
            <div key={group.date}>
              {/* Date header */}
              <div className="sticky top-0 z-10 px-4 py-1.5 bg-cardio-900/90 backdrop-blur-sm">
                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                  {formatDateHeader(group.date)}
                </span>
              </div>

              {/* Items */}
              {group.items.map((item) => (
                <TimelineItem
                  key={item.id}
                  type={item.type}
                  title={item.title}
                  description={item.description}
                  timestamp={item.timestamp}
                  severity={item.severity}
                  value={item.value}
                  patientId={item.patientId}
                />
              ))}
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-slate-500">
            <Clock className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">Aucune activit&eacute; r&eacute;cente</p>
          </div>
        )}
      </div>
    </div>
  );
}
