import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/query-client';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useEffect } from 'react';

export function useMySubscription() {
  const setSubscription = useSubscriptionStore((s) => s.setSubscription);

  const query = useQuery({
    queryKey: queryKeys.subscriptions.me,
    queryFn: async () => {
      const { data } = await api.get('/subscriptions/me');
      return data;
    },
    staleTime: 60 * 1000, // 1 minute
  });

  useEffect(() => {
    if (query.data) {
      setSubscription(query.data.subscription, query.data.isActive);
    }
  }, [query.data, setSubscription]);

  return query;
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reason?: string) => {
      const { data } = await api.post('/subscriptions/cancel', { reason });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.me });
    },
  });
}
