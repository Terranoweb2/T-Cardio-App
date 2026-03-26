'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ClinicalKpiCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: { direction: 'up' | 'down' | 'stable'; label?: string };
  accentColor?: string;
  valueColor?: string;
}

export default function ClinicalKpiCard({
  icon,
  title,
  value,
  subtitle,
  trend,
  accentColor = 'border-l-cyan-500',
  valueColor = 'text-cyan-400',
}: ClinicalKpiCardProps) {
  const trendConfig = {
    up: { icon: TrendingUp, color: 'text-emerald-400' },
    down: { icon: TrendingDown, color: 'text-red-400' },
    stable: { icon: Minus, color: 'text-slate-400' },
  };

  const activeTrend = trend ? trendConfig[trend.direction] : null;
  const TrendIcon = activeTrend?.icon;

  return (
    <div
      className={`glass-card rounded-lg border-l-4 ${accentColor} p-3 relative flex flex-col justify-between min-h-[88px]`}
    >
      {/* Icon - top right */}
      <div className="absolute top-2.5 right-2.5 text-slate-500">
        <span className="w-4 h-4 block [&>svg]:w-4 [&>svg]:h-4">{icon}</span>
      </div>

      {/* Title */}
      <p className="text-[11px] uppercase tracking-wider font-medium text-slate-500 leading-tight pr-6">
        {title}
      </p>

      {/* Value + Trend */}
      <div className="mt-1">
        <span className={`text-2xl font-bold ${valueColor} leading-none`}>
          {value}
        </span>

        {/* Subtitle */}
        {subtitle && (
          <span className="text-xs text-slate-400 ml-1">{subtitle}</span>
        )}
      </div>

      {/* Trend indicator */}
      {trend && TrendIcon && (
        <div className={`flex items-center gap-1 mt-1 ${activeTrend!.color}`}>
          <TrendIcon className="w-3 h-3" />
          {trend.label && (
            <span className="text-[10px] font-medium">{trend.label}</span>
          )}
        </div>
      )}
    </div>
  );
}
