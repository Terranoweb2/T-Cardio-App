import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/query-client';
import { useCreditStore } from '@/stores/creditStore';
import { useEffect } from 'react';

export function useCreditBalance() {
  const setBalance = useCreditStore((s) => s.setBalance);

  const query = useQuery({
    queryKey: queryKeys.credits.balance,
    queryFn: async () => {
      const { data } = await api.get('/credits/balance');
      return data;
    },
    staleTime: 30 * 1000, // 30 seconds
  });

  useEffect(() => {
    if (query.data?.balance !== undefined) {
      setBalance(query.data.balance);
    }
  }, [query.data, setBalance]);

  return query;
}

export function useCreditTransactions(page = 1) {
  return useQuery({
    queryKey: queryKeys.credits.transactions(page),
    queryFn: async () => {
      const { data } = await api.get(`/credits/transactions?page=${page}&limit=20`);
      return data;
    },
    placeholderData: (prev) => prev,
  });
}
