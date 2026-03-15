'use client';

import { Bar } from 'react-chartjs-2';
import { COLORS, defaultBarOptions } from '@/lib/chart-config';

interface MorningEveningData {
  morning?: { avgSystolic: number; avgDiastolic: number; count: number };
  evening?: { avgSystolic: number; avgDiastolic: number; count: number };
}

interface MorningEveningBarChartProps {
  data: MorningEveningData;
}

export default function MorningEveningBarChart({ data }: MorningEveningBarChartProps) {
  if (!data.morning && !data.evening) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-slate-500">Pas de donnees matin/soir disponibles</p>
      </div>
    );
  }

  const labels = ['Systolique', 'Diastolique'];

  const datasets: any[] = [];

  if (data.morning) {
    datasets.push({
      label: `Matin (${data.morning.count} mesures)`,
      data: [data.morning.avgSystolic, data.morning.avgDiastolic],
      backgroundColor: 'rgba(251, 191, 36, 0.6)',
      borderColor: '#fbbf24',
      borderWidth: 2,
      borderRadius: 6,
      barPercentage: 0.6,
    });
  }

  if (data.evening) {
    datasets.push({
      label: `Soir (${data.evening.count} mesures)`,
      data: [data.evening.avgSystolic, data.evening.avgDiastolic],
      backgroundColor: 'rgba(6, 182, 212, 0.6)',
      borderColor: '#06b6d4',
      borderWidth: 2,
      borderRadius: 6,
      barPercentage: 0.6,
    });
  }

  return (
    <Bar
      data={{ labels, datasets }}
      options={{
        ...defaultBarOptions,
        scales: {
          ...defaultBarOptions.scales,
          y: {
            ...defaultBarOptions.scales?.y,
            min: 40,
            max: 180,
            ticks: {
              ...(defaultBarOptions.scales?.y as any)?.ticks,
              stepSize: 20,
            },
          },
        },
        plugins: {
          ...defaultBarOptions.plugins,
          tooltip: {
            ...defaultBarOptions.plugins?.tooltip,
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y} mmHg`,
            },
          },
        },
      }}
    />
  );
}
