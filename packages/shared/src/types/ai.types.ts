export interface PatientAiInput {
  patientId: string;
  measurements: Array<{
    systolic: number;
    diastolic: number;
    pulse?: number;
    date: string;
  }>;
  patientContext?: {
    age?: number;
    gender?: string;
    medicalStatus?: string;
  };
  periodDays: number;
}

export interface AiAnalysisResult {
  riskLevel: string;
  confidenceScore: number;
  projections: {
    '30d': { systolic_trend: string; estimated_avg: number };
    '60d': { systolic_trend: string; estimated_avg: number };
    '90d': { systolic_trend: string; estimated_avg: number };
  } | null;
  alerts: Array<{
    type: 'THRESHOLD' | 'TREND' | 'VARIABILITY';
    severity: string;
    message: string;
  }>;
  patientSummary: string;
  doctorSummary: string;
}
