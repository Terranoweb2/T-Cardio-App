'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Heart, Calendar } from 'lucide-react';

interface PatientMiniCardProps {
  patient: {
    id: string;
    user?: { firstName?: string; lastName?: string; email?: string };
    lastSystolic?: number;
    lastDiastolic?: number;
    lastPulse?: number;
    lastRiskLevel?: string;
    lastMeasuredAt?: string;
  };
}

const riskBadgeStyles: Record<string, string> = {
  FAIBLE: 'bg-green-500/15 text-green-400 border-green-500/30',
  MODERE: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  ELEVE: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  CRITIQUE: 'bg-red-500/15 text-red-400 border-red-500/30',
};

function getDaysSince(dateStr?: string): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getDaysColor(days: number | null): string {
  if (days === null) return 'text-slate-500';
  if (days > 14) return 'text-red-400';
  if (days > 7) return 'text-amber-400';
  return 'text-green-400';
}

function getPatientName(user?: { firstName?: string; lastName?: string }): string {
  if (!user) return 'Patient inconnu';
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'Patient inconnu';
}

export default function PatientMiniCard({ patient }: PatientMiniCardProps) {
  const [expanded, setExpanded] = useState(false);

  const name = getPatientName(patient.user);
  const days = getDaysSince(patient.lastMeasuredAt);
  const daysColor = getDaysColor(days);
  const hasBp =
    patient.lastSystolic !== undefined && patient.lastDiastolic !== undefined;
  const riskLevel = patient.lastRiskLevel;
  const badgeStyle = riskLevel ? riskBadgeStyles[riskLevel] : null;

  return (
    <div className="border-b border-cardio-700/50">
      {/* Compact row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 py-2 px-3 text-sm hover:bg-cardio-700/30 transition-colors"
      >
        {/* Patient name */}
        <span className="flex-1 min-w-0 text-left text-slate-200 truncate font-medium">
          {name}
        </span>

        {/* BP value */}
        {hasBp ? (
          <span className="font-mono text-xs text-slate-300 shrink-0">
            {patient.lastSystolic}/{patient.lastDiastolic}
          </span>
        ) : (
          <span className="text-xs text-slate-600 shrink-0">--/--</span>
        )}

        {/* Risk badge */}
        {badgeStyle && riskLevel ? (
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 font-medium ${badgeStyle}`}
          >
            {riskLevel}
          </span>
        ) : (
          <span className="text-[10px] px-1.5 py-0.5 text-slate-600 shrink-0">
            N/A
          </span>
        )}

        {/* Days since last measure */}
        <span className={`text-xs shrink-0 tabular-nums ${daysColor}`}>
          {days !== null ? `${days}j` : '--'}
        </span>

        {/* Chevron */}
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-2 bg-cardio-800/30">
          <div className="flex items-center gap-4 text-xs text-slate-400">
            {patient.lastPulse !== undefined && (
              <span className="flex items-center gap-1">
                <Heart className="w-3 h-3 text-rose-400" />
                <span className="font-mono">{patient.lastPulse}</span> bpm
              </span>
            )}
            {patient.lastMeasuredAt && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(patient.lastMeasuredAt).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>

          {patient.user?.email && (
            <p className="text-xs text-slate-500 truncate">{patient.user.email}</p>
          )}

          <Link
            href={`/doctor/patients/${patient.id}`}
            className="inline-block text-xs text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
          >
            Voir fiche &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
