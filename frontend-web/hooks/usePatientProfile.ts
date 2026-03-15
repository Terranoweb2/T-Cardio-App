import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/query-client';

export function usePatientProfile(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.patient.profile,
    queryFn: async () => {
      const { data } = await api.get('/patients/profile');
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes — profile rarely changes
    enabled: options?.enabled !== false,
  });
}

export function useUpdatePatientProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.patch('/patients/profile', payload);
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.patient.profile, data);
    },
  });
}
