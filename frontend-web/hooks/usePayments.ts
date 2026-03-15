import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/query-client';

export function useCreditPackages() {
  return useQuery({
    queryKey: queryKeys.payments.packages,
    queryFn: async () => {
      const { data } = await api.get('/payments/packages');
      return data;
    },
    staleTime: 10 * 60 * 1000, // 10 min
  });
}

export function useSubscriptionPlans() {
  return useQuery({
    queryKey: queryKeys.payments.plans,
    queryFn: async () => {
      const { data } = await api.get('/payments/plans');
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useInitiatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      type: 'SUBSCRIPTION' | 'CREDIT_PURCHASE';
      packageId: string;
      callbackUrl?: string;
    }) => {
      const { data } = await api.post('/payments/initiate', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.history() });
    },
  });
}

export function useVerifyPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentId: string) => {
      const { data } = await api.post(`/payments/${paymentId}/verify`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.credits.balance });
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.me });
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.history() });
    },
  });
}

export function usePaymentHistory(page = 1) {
  return useQuery({
    queryKey: queryKeys.payments.history(page),
    queryFn: async () => {
      const { data } = await api.get(`/payments/history?page=${page}&limit=20`);
      return data;
    },
    placeholderData: (prev) => prev,
  });
}
