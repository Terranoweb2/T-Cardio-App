'use client';

import { CheckCircle2, AlertTriangle, Minus } from 'lucide-react';

export interface RiskFactor {
  name: string;
  value: string;
  impact: 'positive' | 'negative' | 'neutral';
}

interface RiskFactorsProps {
  factors: RiskFactor[];
}

const impactConfig: Record<
  RiskFactor['impact'],
  { Icon: typeof CheckCircle2; iconClass: string; borderClass: string }
> = {
  positive: {
    Icon: CheckCircle2,
    iconClass: 'text-green-400',
    borderClass: 'border-l-green-400/40',
  },
  negative: {
    Icon: AlertTriangle,
    iconClass: 'text-red-400',
    borderClass: 'border-l-red-400/40',
  },
  neutral: {
    Icon: Minus,
    iconClass: 'text-slate-500',
    borderClass: 'border-l-slate-500/40',
  },
};

export default function RiskFactors({ factors }: RiskFactorsProps) {
  if (!factors.length) {
    return (
      <div className="glass-card rounded-xl p-5">
        <p className="text-sm text-slate-500 text-center">Aucun facteur de risque disponible</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-200 mb-4">Facteurs de risque</h3>

      <div className="space-y-2">
        {factors.map((factor, idx) => {
          const { Icon, iconClass, borderClass } = impactConfig[factor.impact] ?? impactConfig.neutral;

          return (
            <div
              key={idx}
              className={`flex items-center gap-3 rounded-lg bg-cardio-800/50 border-l-[3px] ${borderClass} px-3 py-2.5 transition-all hover:bg-cardio-700/40`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${iconClass}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-300 truncate">{factor.name}</p>
              </div>
              <span className="text-xs text-slate-400 font-medium shrink-0">
                {factor.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
