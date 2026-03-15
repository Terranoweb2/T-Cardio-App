import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/query-client';

export function useChartData(days: number = 30) {
  return useQuery({
    queryKey: queryKeys.analytics.chartData(days),
    queryFn: async () => {
      const { data } = await api.get(`/analytics/chart-data?days=${days}`);
      return data || [];
    },
  });
}

export function useVariability(days: number = 30) {
  return useQuery({
    queryKey: queryKeys.analytics.variability(days),
    queryFn: async () => {
      const { data } = await api.get(`/analytics/variability?days=${days}`);
      return data;
    },
  });
}

export function useMorningEvening(days: number = 30) {
  return useQuery({
    queryKey: queryKeys.analytics.morningEvening(days),
    queryFn: async () => {
      const { data } = await api.get(`/analytics/morning-evening?days=${days}`);
      return data;
    },
  });
}

export function useTrends(days: number = 30) {
  return useQuery({
    queryKey: queryKeys.analytics.trends(days),
    queryFn: async () => {
      const { data } = await api.get(`/analytics/trends?days=${days}`);
      return data;
    },
  });
}

export function usePatientChartData(patientId: string, days: number = 30) {
  return useQuery({
    queryKey: queryKeys.analytics.patientChartData(patientId, days),
    queryFn: async () => {
      const { data } = await api.get(`/analytics/patient/${patientId}/chart-data?days=${days}`);
      return data || [];
    },
    enabled: !!patientId,
  });
}
