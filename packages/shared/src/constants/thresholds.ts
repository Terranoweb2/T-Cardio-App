export const BP_THRESHOLDS = {
  NORMAL: { systolicMax: 119, diastolicMax: 79 },
  ELEVATED: { systolicMin: 120, systolicMax: 139, diastolicMin: 80, diastolicMax: 89 },
  HIGH: { systolicMin: 140, systolicMax: 179, diastolicMin: 90, diastolicMax: 119 },
  CRITICAL: { systolicMin: 180, diastolicMin: 120 },
} as const;

export const EMERGENCY_SYSTOLIC = 180;
export const EMERGENCY_DIASTOLIC = 120;

export const RISK_COLORS = {
  FAIBLE: '#22c55e',
  MODERE: '#f59e0b',
  ELEVE: '#ef4444',
  CRITIQUE: '#dc2626',
} as const;
