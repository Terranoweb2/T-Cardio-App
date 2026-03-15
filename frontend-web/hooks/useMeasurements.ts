import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/query-client';

interface MeasurementListParams {
  days?: number;
  page?: number;
  limit?: number;
}

export function useMeasurements(params: MeasurementListParams = {}) {
  const { days = 30, page = 1, limit = 20 } = params;

  return useQuery({
    queryKey: queryKeys.measurements.list({ days, page, limit }),
    queryFn: async () => {
      const { data } = await api.get(`/measurements?days=${days}&page=${page}&limit=${limit}`);
      return data;
    },
    placeholderData: (previousData) => previousData, // keep old data while loading next page
  });
}

export function useMeasurementStats(days: number = 30) {
  return useQuery({
    queryKey: queryKeys.measurements.stats(days),
    queryFn: async () => {
      const { data } = await api.get(`/measurements/stats?days=${days}`);
      return data;
    },
  });
}

interface CreateMeasurementPayload {
  systolic: number;
  diastolic: number;
  pulse?: number;
  context?: string;
  notes?: string;
  measuredAt: string;
  source?: string;
  photoPath?: string;
}

export function useCreateMeasurement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateMeasurementPayload) => {
      const { data } = await api.post('/measurements', payload);
      return data;
    },
    onSuccess: () => {
      // Invalidate all measurement and analytics queries
      queryClient.invalidateQueries({ queryKey: queryKeys.measurements.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    },
  });
}
