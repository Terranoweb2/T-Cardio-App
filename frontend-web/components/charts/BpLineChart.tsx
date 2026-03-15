'use client';

import { Line } from 'react-chartjs-2';
import { COLORS, defaultLineOptions, formatChartDate, BP_ZONES } from '@/lib/chart-config';
import type { ChartOptions } from 'chart.js';

interface Measurement {
  measuredAt?: string;
  date?: string;
  systolic: number;
  diastolic: number;
  pulse?: number;
}

interface BpLineChartProps {
  measurements: Measurement[];
  showPulse?: boolean;
  showZones?: boolean;
  compact?: boolean;
}

export default function BpLineChart({
  measurements,
  showPulse = false,
  showZones = true,
  compact = false,
}: BpLineChartProps) {
  const getDate = (m: Measurement) => m.measuredAt || m.date || '';

  // Sort by date ascending
  const sorted = [...measurements].sort(
    (a, b) => new Date(getDate(a)).getTime() - new Date(getDate(b)).getTime()
  );

  const labels = sorted.map((m) => formatChartDate(getDate(m)));

  const datasets: any[] = [
    {
      label: 'Systolique',
      data: sorted.map((m) => m.systolic),
      borderColor: COLORS.systolic,
      backgroundColor: COLORS.systolicLight,
      borderWidth: 2,
      pointRadius: compact ? 2 : 3,
      pointHoverRadius: compact ? 4 : 6,
      tension: 0.3,
      fill: false,
    },
    {
      label: 'Diastolique',
      data: sorted.map((m) => m.diastolic),
      borderColor: COLORS.diastolic,
      backgroundColor: COLORS.diastolicLight,
      borderWidth: 2,
      pointRadius: compact ? 2 : 3,
      pointHoverRadius: compact ? 4 : 6,
      tension: 0.3,
      fill: false,
    },
  ];

  if (showPulse) {
    datasets.push({
      label: 'Pouls',
      data: sorted.map((m) => m.pulse || null),
      borderColor: COLORS.pulse,
      backgroundColor: COLORS.pulseLight,
      borderWidth: 1.5,
      pointRadius: compact ? 1 : 2,
      pointHoverRadius: compact ? 3 : 5,
      tension: 0.3,
      borderDash: [5, 5],
      fill: false,
    });
  }

  const options: ChartOptions<'line'> = {
    ...defaultLineOptions,
    plugins: {
      ...defaultLineOptions.plugins,
      legend: compact
        ? { display: false }
        : defaultLineOptions.plugins?.legend,
      annotation: showZones ? {
        annotations: {
          normalZone: {
            type: 'box',
            yMin: 0,
            yMax: BP_ZONES.normal.systolic,
            backgroundColor: 'rgba(34, 197, 94, 0.04)',
            borderWidth: 0,
          },
          elevatedLine: {
            type: 'line',
            yMin: BP_ZONES.high.systolic,
            yMax: BP_ZONES.high.systolic,
            borderColor: 'rgba(245, 158, 11, 0.4)',
            borderWidth: 1,
            borderDash: [6, 6],
            label: {
              content: '140 mmHg',
              display: !compact,
              position: 'end',
              font: { size: 10 },
              color: '#f59e0b',
            },
          },
          crisisLine: {
            type: 'line',
            yMin: BP_ZONES.crisis.systolic,
            yMax: BP_ZONES.crisis.systolic,
            borderColor: 'rgba(239, 68, 68, 0.4)',
            borderWidth: 1,
            borderDash: [6, 6],
            label: {
              content: '180 mmHg',
              display: !compact,
              position: 'end',
              font: { size: 10 },
              color: '#ef4444',
            },
          },
        },
      } : undefined,
    } as any,
    scales: {
      ...defaultLineOptions.scales,
      x: {
        ...defaultLineOptions.scales?.x,
        ticks: {
          ...(defaultLineOptions.scales?.x as any)?.ticks,
          maxTicksLimit: compact ? 5 : 12,
        },
      },
      y: {
        ...defaultLineOptions.scales?.y,
        min: 40,
        max: sorted.some((m) => m.systolic > 180) ? 220 : 200,
      },
    },
  };

  return <Line data={{ labels, datasets }} options={options} />;
}
