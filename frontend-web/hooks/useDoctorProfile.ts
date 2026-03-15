import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/query-client';

export function useDoctorProfile(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.doctor.profile,
    queryFn: async () => {
      const { data } = await api.get('/doctors/profile');
      return data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled !== false,
  });
}

export function useUpdateDoctorProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.patch('/doctors/profile', payload);
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.doctor.profile, data);
    },
  });
}
