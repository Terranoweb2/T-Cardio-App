'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { format, isToday, addDays, isBefore } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, Video, CalendarOff } from 'lucide-react';

interface Appointment {
  id: string;
  scheduledAt: string;
  patientName?: string;
  patient?: { firstName?: string; lastName?: string };
  status?: string;
  type?: string;
}

interface Teleconsultation {
  id: string;
  scheduledAt: string;
  patientName?: string;
  patient?: { firstName?: string; lastName?: string };
  status?: string;
}

interface AgendaTeleconsultationProps {
  appointments: Appointment[];
  teleconsultations: Teleconsultation[];
}

function getPatientName(item: Appointment | Teleconsultation): string {
  if (item.patientName) return item.patientName;
  if (item.patient) {
    const first = item.patient.firstName ?? '';
    const last = item.patient.lastName ?? '';
    return `${first} ${last}`.trim() || 'Patient inconnu';
  }
  return 'Patient inconnu';
}

function parseAsUTC(dateStr: string): Date {
  // Strip timezone suffix so date-fns treats the value as-is (stored local time)
  const d = new Date(dateStr);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes());
}

function formatTime(dateStr: string): string {
  return format(parseAsUTC(dateStr), 'HH:mm', { locale: fr });
}

function formatDateShort(dateStr: string): string {
  return format(parseAsUTC(dateStr), 'EEE dd MMM', { locale: fr });
}

function StatusBadge({ status }: { status?: string }) {
  const statusMap: Record<string, { label: string; classes: string }> = {
    CONFIRMED: { label: 'Confirme', classes: 'bg-emerald-500/20 text-emerald-400' },
    PLANNED: { label: 'Planifie', classes: 'bg-blue-500/20 text-blue-400' },
    PENDING: { label: 'En attente', classes: 'bg-amber-500/20 text-amber-400' },
    CANCELLED: { label: 'Annule', classes: 'bg-red-500/20 text-red-400' },
    COMPLETED: { label: 'Termine', classes: 'bg-slate-500/20 text-slate-400' },
  };

  const s = statusMap[status ?? ''] ?? {
    label: status ?? 'N/A',
    classes: 'bg-slate-500/20 text-slate-400',
  };

  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${s.classes}`}>
      {s.label}
    </span>
  );
}

function TypeBadge({ type }: { type: 'RDV' | 'TC' }) {
  const classes =
    type === 'TC'
      ? 'bg-violet-500/20 text-violet-400'
      : 'bg-blue-500/20 text-blue-400';

  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${classes}`}>
      {type}
    </span>
  );
}

export default function AgendaTeleconsultation({
  appointments,
  teleconsultations,
}: AgendaTeleconsultationProps) {
  // Today's merged agenda
  const todayItems = useMemo(() => {
    const todayAppts = appointments
      .filter((a) => isToday(new Date(a.scheduledAt)))
      .map((a) => ({ ...a, _type: 'RDV' as const }));

    const todayTc = teleconsultations
      .filter((t) => isToday(new Date(t.scheduledAt)))
      .map((t) => ({ ...t, _type: 'TC' as const }));

    return [...todayAppts, ...todayTc].sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );
  }, [appointments, teleconsultations]);

  // Upcoming teleconsultations (next 7 days, PLANNED only)
  const upcomingTc = useMemo(() => {
    const now = new Date();
    const limit = addDays(now, 7);

    return teleconsultations
      .filter((t) => {
        const d = new Date(t.scheduledAt);
        return t.status === 'PLANNED' && d >= now && isBefore(d, limit);
      })
      .sort(
        (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      );
  }, [teleconsultations]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left: Today's agenda */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-cyan-400" />
          <h3 className="font-semibold text-slate-200">Agenda du jour</h3>
          {todayItems.length > 0 && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400">
              {todayItems.length}
            </span>
          )}
        </div>

        {todayItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-500">
            <CalendarOff className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">Aucun rendez-vous aujourd&apos;hui</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {todayItems.map((item) => (
              <li
                key={`${item._type}-${item.id}`}
                className="flex items-center gap-3 rounded-lg px-3 py-2 bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
              >
                <span className="font-mono text-xs text-slate-400 w-12 shrink-0">
                  {formatTime(item.scheduledAt)}
                </span>
                <span className="text-sm text-slate-200 flex-1 truncate">
                  {getPatientName(item)}
                </span>
                <TypeBadge type={item._type} />
                <StatusBadge status={item.status} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Right: Upcoming teleconsultations */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Video className="w-4 h-4 text-violet-400" />
          <h3 className="font-semibold text-slate-200">Teleconsultations a venir</h3>
          {upcomingTc.length > 0 && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400">
              {upcomingTc.length}
            </span>
          )}
        </div>

        {upcomingTc.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-500">
            <Video className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">Aucune teleconsultation prevue</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {upcomingTc.map((tc) => (
              <li
                key={tc.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2 bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
              >
                <div className="shrink-0 text-right w-20">
                  <p className="text-[11px] text-slate-400 leading-tight">
                    {formatDateShort(tc.scheduledAt)}
                  </p>
                  <p className="font-mono text-xs text-slate-300">
                    {formatTime(tc.scheduledAt)}
                  </p>
                </div>
                <span className="text-sm text-slate-200 flex-1 truncate">
                  {getPatientName(tc)}
                </span>
                <StatusBadge status={tc.status} />
                <Link
                  href={`/teleconsultations/${tc.id}`}
                  className="text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors shrink-0"
                >
                  Rejoindre
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
