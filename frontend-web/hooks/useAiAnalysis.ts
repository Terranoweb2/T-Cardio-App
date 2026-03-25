import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/query-client';

export function useLatestAnalysis() {
  return useQuery({
    queryKey: queryKeys.ai.latest,
    queryFn: async () => {
      const { data } = await api.get('/ai/latest');
      return data;
    },
  });
}

export function useAnalysisHistory(page: number = 1) {
  return useQuery({
    queryKey: queryKeys.ai.analyses(page),
    queryFn: async () => {
      const { data } = await api.get(`/ai/analyses?page=${page}`);
      return data;
    },
  });
}

export function useRunAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/ai/analyze', { days: 30 });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.latest });
      queryClient.invalidateQueries({ queryKey: ['ai', 'analyses'] });
    },
  });
}
