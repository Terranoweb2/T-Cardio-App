'use client';

import { Stethoscope, Pill, AlertTriangle, FileSearch } from 'lucide-react';

interface QuickActionsProps {
  onAction: (text: string) => void;
}

const actions = [
  {
    label: 'Verifier mes symptomes',
    icon: Stethoscope,
    color: 'cyan',
    prefill: 'Je souhaite verifier mes symptomes. Voici ce que je ressens : ',
    iconClass: 'text-cyan-400',
    borderClass: 'hover:border-cyan-400/40',
    bgClass: 'bg-cyan-500/10',
  },
  {
    label: 'Info sur un medicament',
    icon: Pill,
    color: 'teal',
    prefill: 'Je voudrais des informations sur le medicament suivant : ',
    iconClass: 'text-teal-400',
    borderClass: 'hover:border-teal-400/40',
    bgClass: 'bg-teal-500/10',
  },
  {
    label: 'Conseils urgence',
    icon: AlertTriangle,
    color: 'amber',
    prefill: 'J\'ai besoin de conseils urgents concernant : ',
    iconClass: 'text-amber-400',
    borderClass: 'hover:border-amber-400/40',
    bgClass: 'bg-amber-500/10',
  },
  {
    label: 'Comprendre mes resultats',
    icon: FileSearch,
    color: 'green',
    prefill: 'Pouvez-vous m\'aider a comprendre mes resultats : ',
    iconClass: 'text-green-400',
    borderClass: 'hover:border-green-400/40',
    bgClass: 'bg-green-500/10',
  },
];

export default function QuickActions({ onAction }: QuickActionsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 max-w-md mx-auto w-full">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            onClick={() => onAction(action.prefill)}
            className={`glass-card rounded-xl p-4 flex flex-col items-center gap-3 transition-all duration-200 ${action.borderClass} hover:scale-[1.02] active:scale-[0.98]`}
          >
            <div className={`w-12 h-12 rounded-full ${action.bgClass} flex items-center justify-center`}>
              <Icon className={`w-6 h-6 ${action.iconClass}`} />
            </div>
            <span className="text-sm text-slate-300 font-medium text-center leading-tight">
              {action.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
