'use client';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import ChartWrapper from '@/components/charts/ChartWrapper';
import BpLineChart from '@/components/charts/BpLineChart';
import RiskDoughnutChart from '@/components/charts/RiskDoughnutChart';
import MorningEveningBarChart from '@/components/charts/MorningEveningBarChart';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

interface ConsultationStats {
  today: number;
  thisWeek: number;
  thisMonth: number;
  thisQuarter: number;
}

interface AnalyticsRowProps {
  patients: any[];
  chartData: any;
  morningEvening: any;
  consultationStats: ConsultationStats;
}

const consultationBarOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(10, 22, 40, 0.95)',
      padding: 12,
      cornerRadius: 8,
      borderColor: 'rgba(6, 182, 212, 0.2)',
      borderWidth: 1,
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: '#64748b', font: { size: 11 } },
    },
    y: {
      grid: { color: '#1e293b' },
      ticks: { color: '#64748b', font: { size: 11 }, stepSize: 1 },
      beginAtZero: true,
    },
  },
} as const;

function ConsultationBarChart({ stats }: { stats: ConsultationStats }) {
  const data = {
    labels: ["Aujourd'hui", 'Semaine', 'Mois', 'Trimestre'],
    datasets: [
      {
        data: [stats.today, stats.thisWeek, stats.thisMonth, stats.thisQuarter],
        backgroundColor: [
          'rgba(6, 182, 212, 0.9)',
          'rgba(6, 182, 212, 0.7)',
          'rgba(6, 182, 212, 0.5)',
          'rgba(6, 182, 212, 0.35)',
        ],
        borderColor: [
          '#06b6d4',
          '#06b6d4',
          '#06b6d4',
          '#06b6d4',
        ],
        borderWidth: 1,
        borderRadius: 6,
        barPercentage: 0.65,
      },
    ],
  };

  return <Bar data={data} options={consultationBarOptions as any} />;
}

export default function AnalyticsRow({
  patients,
  chartData,
  morningEvening,
  consultationStats,
}: AnalyticsRowProps) {
  const riskMeasurements = patients
    .filter((p) => p.lastRiskLevel)
    .map((p) => ({ riskLevel: p.lastRiskLevel }));

  const hasBpData =
    chartData?.measurements?.length > 0 || chartData?.length > 0;
  const hasRiskData = riskMeasurements.length > 0;
  const hasMorningEvening = morningEvening?.morning || morningEvening?.evening;

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
        Analytique
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* 1. BP Trends (30 days) */}
        <ChartWrapper
          title="Tendances tensionnelles"
          subtitle="30 derniers jours"
          empty={!hasBpData}
        >
          <BpLineChart
            measurements={chartData?.measurements ?? chartData ?? []}
            compact
            showZones
          />
        </ChartWrapper>

        {/* 2. Risk Distribution */}
        <ChartWrapper
          title="Distribution des risques"
          subtitle="Ensemble des patients"
          empty={!hasRiskData}
        >
          <RiskDoughnutChart measurements={riskMeasurements} />
        </ChartWrapper>

        {/* 3. Consultation Activity */}
        <ChartWrapper
          title="Activite consultations"
          subtitle="Volume par periode"
        >
          <ConsultationBarChart stats={consultationStats} />
        </ChartWrapper>

        {/* 4. Morning vs Evening */}
        <ChartWrapper
          title="Matin vs Soir"
          subtitle="Moyennes tensionnelles"
          empty={!hasMorningEvening}
        >
          <MorningEveningBarChart data={morningEvening ?? {}} />
        </ChartWrapper>
      </div>
    </section>
  );
}
