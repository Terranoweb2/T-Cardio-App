'use client';

import { Line } from 'react-chartjs-2';
import { COLORS } from '@/lib/chart-config';

interface BpStatsCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: 'rising' | 'falling' | 'stable';
  sparklineData?: number[];
  sparklineColor?: string;
}

export default function BpStatsCard({
  title,
  value,
  subtitle,
  trend,
  sparklineData,
  sparklineColor = COLORS.primary,
}: BpStatsCardProps) {
  const trendIcon = trend === 'rising' ? '↑' : trend === 'falling' ? '↓' : '→';
  const trendColor = trend === 'rising' ? 'text-red-400' : trend === 'falling' ? 'text-green-400' : 'text-slate-500';
  const trendLabel = trend === 'rising' ? 'En hausse' : trend === 'falling' ? 'En baisse' : 'Stable';

  return (
    <div className="glass-card p-3.5 sm:p-5 rounded-xl">
      <p className="text-xs sm:text-sm text-slate-400 mb-0.5 sm:mb-1">{title}</p>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xl sm:text-2xl font-bold text-slate-100">{value}</p>
          {subtitle && <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          {trend && (
            <p className={`text-[11px] sm:text-xs font-medium mt-0.5 sm:mt-1 ${trendColor}`}>
              {trendIcon} {trendLabel}
            </p>
          )}
        </div>
        {sparklineData && sparklineData.length > 2 && (
          <div className="w-20 h-10 sm:w-24 sm:h-12">
            <Line
              data={{
                labels: sparklineData.map((_, i) => i.toString()),
                datasets: [
                  {
                    data: sparklineData,
                    borderColor: sparklineColor,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.4,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: {
                  x: { display: false },
                  y: { display: false },
                },
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
