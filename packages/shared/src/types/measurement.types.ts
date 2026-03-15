export interface BpMeasurementData {
  systolic: number;
  diastolic: number;
  pulse?: number;
  source: 'MANUEL' | 'BLUETOOTH';
  context: 'REPOS' | 'APRES_EFFORT' | 'MATIN' | 'SOIR' | 'STRESS' | 'INCONNU';
  notes?: string;
  measuredAt: string;
}

export interface MeasurementStats {
  count: number;
  period: { days: number; from: string; to: string };
  systolic: { avg: number; min: number; max: number };
  diastolic: { avg: number; min: number; max: number };
  pulse: { avg: number; min: number; max: number } | null;
  emergencyCount: number;
}

export type RiskLevel = 'FAIBLE' | 'MODERE' | 'ELEVE' | 'CRITIQUE';
