import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/query-client';

// ==================== DOCTOR SIDE ====================

export function useDoctorInvitations() {
  return useQuery({
    queryKey: queryKeys.doctor.invitations,
    queryFn: async () => {
      const { data } = await api.get('/doctors/invitations');
      return data;
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useGenerateInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (expiresInHours?: number) => {
      const { data } = await api.post('/doctors/invitations/generate', {
        expiresInHours: expiresInHours || 48,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.doctor.invitations });
    },
  });
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tokenId: string) => {
      const { data } = await api.delete(`/doctors/invitations/${tokenId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.doctor.invitations });
    },
  });
}

// ==================== PATIENT SIDE ====================

export function useRedeemToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      const { data } = await api.post('/patients/redeem-token', { token });
      return data;
    },
    onSuccess: () => {
      // Refresh any doctor-related queries if needed
      queryClient.invalidateQueries({ queryKey: ['patient'] });
    },
  });
}
