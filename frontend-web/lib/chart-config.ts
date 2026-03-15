import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// T-Cardio dark theme color palette
export const COLORS = {
  primary: '#06b6d4',         // Cyan-500
  primaryLight: '#22d3ee',    // Cyan-400
  systolic: '#f87171',        // Red-400
  systolicLight: 'rgba(248, 113, 113, 0.15)',
  diastolic: '#06b6d4',      // Cyan-500
  diastolicLight: 'rgba(6, 182, 212, 0.15)',
  pulse: '#a78bfa',           // Violet-400
  pulseLight: 'rgba(167, 139, 250, 0.15)',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  critical: '#dc2626',
  grid: 'rgba(6, 182, 212, 0.08)',       // Subtle cyan grid
  text: '#e2e8f0',            // Slate-200
  textLight: '#94a3b8',       // Slate-400
};

export const RISK_COLORS: Record<string, string> = {
  FAIBLE: '#22c55e',
  MODERE: '#f59e0b',
  ELEVE: '#ef4444',
  CRITIQUE: '#dc2626',
};

export const RISK_BG_COLORS: Record<string, string> = {
  FAIBLE: 'rgba(34, 197, 94, 0.6)',
  MODERE: 'rgba(245, 158, 11, 0.6)',
  ELEVE: 'rgba(239, 68, 68, 0.6)',
  CRITIQUE: 'rgba(220, 38, 38, 0.6)',
};

export const BP_ZONES = {
  normal: { systolic: 120, diastolic: 80 },
  elevated: { systolic: 130, diastolic: 85 },
  high: { systolic: 140, diastolic: 90 },
  crisis: { systolic: 180, diastolic: 120 },
};

export const defaultLineOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index',
    intersect: false,
  },
  plugins: {
    legend: {
      position: 'top',
      labels: {
        usePointStyle: true,
        pointStyle: 'circle',
        padding: 16,
        font: { size: 12 },
        color: COLORS.textLight,
      },
    },
    tooltip: {
      backgroundColor: 'rgba(10, 22, 40, 0.95)',
      padding: 12,
      titleFont: { size: 13 },
      bodyFont: { size: 12 },
      cornerRadius: 8,
      borderColor: 'rgba(6, 182, 212, 0.2)',
      borderWidth: 1,
    },
  },
  scales: {
    x: {
      grid: { color: COLORS.grid },
      ticks: { color: COLORS.textLight, font: { size: 11 }, maxRotation: 45 },
    },
    y: {
      grid: { color: COLORS.grid },
      ticks: { color: COLORS.textLight, font: { size: 11 } },
    },
  },
};

export const defaultBarOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
      labels: {
        usePointStyle: true,
        pointStyle: 'circle',
        padding: 16,
        font: { size: 12 },
        color: COLORS.textLight,
      },
    },
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
      ticks: { color: COLORS.textLight, font: { size: 12 } },
    },
    y: {
      grid: { color: COLORS.grid },
      ticks: { color: COLORS.textLight, font: { size: 11 } },
    },
  },
};

export const defaultDoughnutOptions: ChartOptions<'doughnut'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        usePointStyle: true,
        pointStyle: 'circle',
        padding: 16,
        font: { size: 12 },
        color: COLORS.textLight,
      },
    },
    tooltip: {
      backgroundColor: 'rgba(10, 22, 40, 0.95)',
      padding: 12,
      cornerRadius: 8,
      borderColor: 'rgba(6, 182, 212, 0.2)',
      borderWidth: 1,
    },
  },
};

export function formatChartDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

export function formatChartDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
