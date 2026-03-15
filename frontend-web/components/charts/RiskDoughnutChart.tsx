'use client';

import { Doughnut } from 'react-chartjs-2';
import { RISK_BG_COLORS, RISK_COLORS, defaultDoughnutOptions } from '@/lib/chart-config';

interface RiskDoughnutChartProps {
  measurements: Array<{ riskLevel?: string }>;
}

const RISK_LABELS: Record<string, string> = {
  FAIBLE: 'Faible',
  MODERE: 'Modere',
  ELEVE: 'Eleve',
  CRITIQUE: 'Critique',
};

export default function RiskDoughnutChart({ measurements }: RiskDoughnutChartProps) {
  // Count measurements by risk level
  const counts: Record<string, number> = { FAIBLE: 0, MODERE: 0, ELEVE: 0, CRITIQUE: 0 };

  measurements.forEach((m) => {
    if (m.riskLevel && counts[m.riskLevel] !== undefined) {
      counts[m.riskLevel]++;
    }
  });

  const activeRisks = Object.entries(counts).filter(([, count]) => count > 0);

  if (activeRisks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-slate-500">Aucune donnee de risque</p>
      </div>
    );
  }

  const labels = activeRisks.map(([key]) => RISK_LABELS[key] || key);
  const data = activeRisks.map(([, count]) => count);
  const backgroundColors = activeRisks.map(([key]) => RISK_BG_COLORS[key]);
  const borderColors = activeRisks.map(([key]) => RISK_COLORS[key]);

  const total = data.reduce((a, b) => a + b, 0);

  return (
    <div className="relative h-full">
      <Doughnut
        data={{
          labels,
          datasets: [
            {
              data,
              backgroundColor: backgroundColors,
              borderColor: borderColors,
              borderWidth: 2,
              hoverOffset: 8,
            },
          ],
        }}
        options={{
          ...defaultDoughnutOptions,
          cutout: '60%',
          plugins: {
            ...defaultDoughnutOptions.plugins,
            tooltip: {
              ...defaultDoughnutOptions.plugins?.tooltip,
              callbacks: {
                label: (ctx) => {
                  const value = ctx.parsed;
                  const pct = ((value / total) * 100).toFixed(0);
                  return ` ${ctx.label}: ${value} mesure${value > 1 ? 's' : ''} (${pct}%)`;
                },
              },
            },
          },
        }}
      />
      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ marginBottom: '40px' }}>
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-100">{total}</p>
          <p className="text-xs text-slate-500">mesures</p>
        </div>
      </div>
    </div>
  );
}
