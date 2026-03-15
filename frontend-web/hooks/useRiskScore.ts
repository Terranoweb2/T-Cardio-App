import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
const riskScoreKeys = {
  all: ['risk-score'] as const,
  latest: ['risk-score', 'latest'] as const,
  history: (limit: number) => ['risk-score', 'history', limit] as const,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface RiskFactor {
  name: string;
  value: string;
  impact: 'positive' | 'negative' | 'neutral';
}

export interface RiskScoreResult {
  score: number;
  riskLevel: string;
  inputData: Record<string, unknown>;
  factors: RiskFactor[];
  recommendations: string[];
  calculatedAt?: string;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Fetch the latest calculated risk score for the current user. */
export function useLatestRiskScore() {
  return useQuery<RiskScoreResult>({
    queryKey: riskScoreKeys.latest,
    queryFn: () => api.get('/risk-score/latest').then((r) => r.data),
    retry: false, // the user may not have a score yet
  });
}

/** Fetch historical risk scores. */
export function useRiskScoreHistory(limit = 10) {
  return useQuery<RiskScoreResult[]>({
    queryKey: riskScoreKeys.history(limit),
    queryFn: () =>
      api.get('/risk-score/history', { params: { limit } }).then((r) => r.data),
  });
}

/** Trigger a new risk-score calculation on the backend. */
export function useCalculateRiskScore() {
  const qc = useQueryClient();

  return useMutation<RiskScoreResult>({
    mutationFn: () => api.post('/risk-score/calculate').then((r) => r.data),
    onSuccess: () => {
      toast.success('Score de risque calcule');
      qc.invalidateQueries({ queryKey: riskScoreKeys.all });
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message || 'Donnees insuffisantes pour le calcul';
      // Don't show toast for errors that the UI handles with a modal popup
      const isModalError =
        /sexe|biologique|profil|genre|age|date de naissance|mesure|pression|enregistrer|tension/i.test(msg);
      if (!isModalError) {
        toast.error(msg);
      }
    },
  });
}
