'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { differenceInDays } from 'date-fns';
import { ShieldAlert, UserX, ClipboardList } from 'lucide-react';

interface Patient {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  lastRiskLevel?: string;
  lastSystolic?: number;
  lastDiastolic?: number;
  lastMeasuredAt?: string;
}

interface AlertsUrgentActionsProps {
  patients: Patient[];
}

const RISK_BADGE: Record<string, { label: string; classes: string }> = {
  FAIBLE: { label: 'Faible', classes: 'bg-emerald-500/20 text-emerald-400' },
  MODERE: { label: 'Modere', classes: 'bg-amber-500/20 text-amber-400' },
  ELEVE: { label: 'Eleve', classes: 'bg-red-500/20 text-red-400' },
  CRITIQUE: { label: 'Critique', classes: 'bg-red-600/25 text-red-300' },
};

function patientName(p: Patient): string {
  if (p.name) return p.name;
  const first = p.firstName ?? '';
  const last = p.lastName ?? '';
  return `${first} ${last}`.trim() || 'Patient inconnu';
}

function formatBp(systolic?: number, diastolic?: number): string {
  if (!systolic || !diastolic) return '--/--';
  return `${systolic}/${diastolic}`;
}

function daysSince(dateStr?: string): number | null {
  if (!dateStr) return null;
  return differenceInDays(new Date(), new Date(dateStr));
}

export default function AlertsUrgentActions({
  patients,
}: AlertsUrgentActionsProps) {
  // Panel 1: Critical patients
  const criticalPatients = useMemo(
    () =>
      patients.filter(
        (p) => p.lastRiskLevel === 'ELEVE' || p.lastRiskLevel === 'CRITIQUE'
      ),
    [patients]
  );

  // Panel 2: Lost to follow-up (no measurement in 14+ days or never measured)
  const lostPatients = useMemo(() => {
    const now = new Date();
    return patients.filter((p) => {
      if (!p.lastMeasuredAt) return true;
      return differenceInDays(now, new Date(p.lastMeasuredAt)) > 14;
    });
  }, [patients]);

  // Panel 3: Daily summary counts
  const todayMeasurements = useMemo(() => {
    const todayStr = new Date().toDateString();
    return patients.filter(
      (p) =>
        p.lastMeasuredAt &&
        new Date(p.lastMeasuredAt).toDateString() === todayStr
    ).length;
  }, [patients]);

  const totalAlerts = criticalPatients.length + lostPatients.length;

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
        Alertes et actions urgentes
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Panel 1: Critical patients */}
        <div className="glass-card rounded-xl border-l-4 border-l-red-500 p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            <h3 className="font-semibold text-slate-200">Patients critiques</h3>
            {criticalPatients.length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">
                {criticalPatients.length}
              </span>
            )}
          </div>

          {criticalPatients.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-slate-500">
              <p className="text-sm">Aucun patient critique</p>
            </div>
          ) : (
            <ul className="space-y-2 max-h-48 sm:max-h-56 lg:max-h-64 overflow-y-auto">
              {criticalPatients.map((p) => {
                const badge = RISK_BADGE[p.lastRiskLevel!];
                const days = daysSince(p.lastMeasuredAt);
                return (
                  <li
                    key={p.id}
                    className="rounded-lg px-3 py-2 bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-slate-200 truncate">
                        {patientName(p)}
                      </span>
                      {badge && (
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${badge.classes}`}
                        >
                          {badge.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono text-xs text-slate-400">
                        {formatBp(p.lastSystolic, p.lastDiastolic)} mmHg
                      </span>
                      <div className="flex items-center gap-2">
                        {days !== null && (
                          <span className="text-[10px] text-slate-500">
                            il y a {days}j
                          </span>
                        )}
                        <Link
                          href={`/patients/${p.id}`}
                          className="text-[11px] font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
                        >
                          Voir fiche
                        </Link>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Panel 2: Lost to follow-up */}
        <div className="glass-card rounded-xl border-l-4 border-l-amber-500 p-5">
          <div className="flex items-center gap-2 mb-4">
            <UserX className="w-4 h-4 text-amber-400" />
            <h3 className="font-semibold text-slate-200">Perdus de vue</h3>
            {lostPatients.length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                {lostPatients.length}
              </span>
            )}
          </div>

          {lostPatients.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-slate-500">
              <p className="text-sm">Tous les patients sont suivis</p>
            </div>
          ) : (
            <ul className="space-y-2 max-h-48 sm:max-h-56 lg:max-h-64 overflow-y-auto">
              {lostPatients.map((p) => {
                const days = daysSince(p.lastMeasuredAt);
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-lg px-3 py-2 bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-slate-200 truncate">
                        {patientName(p)}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {days !== null ? `${days} jours sans mesure` : 'Jamais mesure'}
                      </p>
                    </div>
                    <Link
                      href={`/messaging?contact=${p.id}`}
                      className="text-[11px] font-medium text-amber-400 hover:text-amber-300 transition-colors shrink-0 ml-2"
                    >
                      Contacter
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Panel 3: Daily summary */}
        <div className="glass-card rounded-xl border-l-4 border-l-blue-500 p-5">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="w-4 h-4 text-blue-400" />
            <h3 className="font-semibold text-slate-200">Resume</h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg px-3 py-2.5 bg-white/[0.02]">
              <span className="text-sm text-slate-400">
                Nouvelles mesures aujourd&apos;hui
              </span>
              <span className="text-lg font-bold text-cyan-400">
                {todayMeasurements}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg px-3 py-2.5 bg-white/[0.02]">
              <span className="text-sm text-slate-400">Patients critiques</span>
              <span className="text-lg font-bold text-red-400">
                {criticalPatients.length}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg px-3 py-2.5 bg-white/[0.02]">
              <span className="text-sm text-slate-400">Perdus de vue</span>
              <span className="text-lg font-bold text-amber-400">
                {lostPatients.length}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg px-3 py-2.5 bg-white/[0.03] border border-slate-700/50">
              <span className="text-sm font-medium text-slate-300">
                Total alertes
              </span>
              <span className="text-lg font-bold text-slate-100">
                {totalAlerts}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
