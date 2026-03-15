'use client';

import { Target, Calendar, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import type { Goal, GoalType } from '@/hooks/useGamification';

interface GoalCardProps {
  goal: Goal;
}

const goalTypeLabels: Record<GoalType, string> = {
  CONSECUTIVE_MEASUREMENTS: 'Mesures consecutives',
  MEDICATION_ADHERENCE: 'Observance medicaments',
  WEIGHT_GOAL: 'Objectif poids',
  EXERCISE_MINUTES: 'Minutes exercice',
  BP_GOAL: 'Objectif tension',
  CUSTOM: 'Personnalise',
};

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  ACTIVE: { label: 'En cours', color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20', icon: Clock },
  COMPLETED: { label: 'Atteint', color: 'bg-green-500/15 text-green-400 border-green-500/20', icon: CheckCircle2 },
  FAILED: { label: 'Non atteint', color: 'bg-red-500/15 text-red-400 border-red-500/20', icon: AlertTriangle },
  EXPIRED: { label: 'Expire', color: 'bg-slate-500/15 text-slate-400 border-slate-500/20', icon: AlertTriangle },
};

export default function GoalCard({ goal }: GoalCardProps) {
  const progress = goal.targetValue > 0
    ? Math.min((goal.currentValue / goal.targetValue) * 100, 100)
    : 0;

  const status = statusConfig[goal.status] || statusConfig.ACTIVE;
  const StatusIcon = status.icon;
  const typeLabel = goalTypeLabels[goal.type as GoalType] || goal.type;

  const isOverdue = goal.deadline && new Date(goal.deadline) < new Date() && goal.status === 'ACTIVE';

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="glass-card rounded-xl p-4 hover:border-cyan-500/20 transition-all duration-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/20 flex items-center justify-center shrink-0">
            <Target className="w-4.5 h-4.5 text-cyan-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-200 truncate">{goal.title}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded bg-cardio-800 border border-cyan-500/10 text-slate-400">
                {typeLabel}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 ${status.color}`}>
                <StatusIcon className="w-3 h-3" />
                {status.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      {goal.description && (
        <p className="text-xs text-slate-500 mb-3 line-clamp-2">{goal.description}</p>
      )}

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-slate-300">
            {goal.currentValue}{goal.unit ? ` ${goal.unit}` : ''}{' '}
            <span className="text-slate-500">/</span>{' '}
            {goal.targetValue}{goal.unit ? ` ${goal.unit}` : ''}
          </span>
          <span className={`text-sm font-bold ${
            progress >= 100 ? 'text-green-400' : 'text-cyan-400'
          }`}>
            {Math.round(progress)}%
          </span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-cardio-800 border border-cyan-500/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              progress >= 100
                ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                : 'bg-gradient-to-r from-cyan-500 via-teal-500 to-cyan-400'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Footer: deadline */}
      {goal.deadline && (
        <div className={`flex items-center gap-1.5 text-xs ${
          isOverdue ? 'text-red-400' : 'text-slate-500'
        }`}>
          <Calendar className="w-3.5 h-3.5" />
          <span>
            {isOverdue ? 'Expire le' : 'Echeance :'} {formatDate(goal.deadline)}
          </span>
        </div>
      )}
    </div>
  );
}
