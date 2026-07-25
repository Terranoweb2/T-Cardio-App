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

// ─── MTN MoMo Collections API (automatic confirmation) ───

/** Whether the live MTN MoMo API is configured (else use the manual USSD flow). */
export function useMomoApiConfig() {
  return useQuery({
    queryKey: ['payments', 'momo', 'config'],
    queryFn: async () => {
      const { data } = await api.get('/payments/momo/config');
      return data as { apiEnabled: boolean };
    },
    staleTime: 10 * 60 * 1000,
  });
}

/** Initiate a payment via the MTN MoMo API (Request to Pay). */
export function useRequestToPay() {
  return useMutation({
    mutationFn: async (payload: {
      type: 'SUBSCRIPTION' | 'CREDIT_PURCHASE';
      packageId: string;
      msisdn: string;
    }) => {
      const { data } = await api.post('/payments/momo/request-to-pay', payload);
      return data as {
        success: boolean;
        paymentId: string;
        referenceId: string;
        amount: number;
        status: string;
        message: string;
      };
    },
  });
}

/** Poll/finalize a MoMo API payment while the payer approves on their phone. */
export function useCheckMomoStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentId: string) => {
      const { data } = await api.post(`/payments/momo/${paymentId}/status`);
      return data as { status: 'pending' | 'completed' | 'failed'; reason?: string };
    },
    onSuccess: (data) => {
      if (data.status === 'completed') {
        queryClient.invalidateQueries({ queryKey: queryKeys.credits.balance });
        queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.me });
        queryClient.invalidateQueries({ queryKey: queryKeys.payments.history() });
      }
    },
  });
}
