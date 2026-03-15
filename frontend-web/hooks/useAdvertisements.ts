import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/query-client';
import { useAdStore } from '@/stores/adStore';
import { useEffect } from 'react';

export function useActiveAds() {
  const setAds = useAdStore((s) => s.setAds);

  const query = useQuery({
    queryKey: queryKeys.advertisements.active,
    queryFn: async () => {
      const { data } = await api.get('/advertisements/active');
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  useEffect(() => {
    if (query.data) {
      const ads = Array.isArray(query.data) ? query.data : (query.data.data || []);
      const popups = ads.filter((a: any) => a.type === 'POPUP');
      const tickers = ads.filter((a: any) => a.type === 'TICKER');
      setAds(popups, tickers);
    }
  }, [query.data, setAds]);

  return query;
}

export function useAdminAds(page: number = 1, type?: string) {
  return useQuery({
    queryKey: queryKeys.advertisements.admin({ page, type }),
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (type) params.set('type', type);
      const { data } = await api.get(`/advertisements/admin?${params.toString()}`);
      return data;
    },
    placeholderData: (prev: any) => prev,
  });
}
