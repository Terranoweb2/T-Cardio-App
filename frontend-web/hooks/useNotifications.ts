import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/query-client';

export function useNotifications(limit: number = 20) {
  return useQuery({
    queryKey: queryKeys.notifications.list(limit),
    queryFn: async () => {
      const { data } = await api.get(`/notifications?limit=${limit}`);
      return data;
    },
    refetchInterval: 30 * 1000, // Poll every 30s as backup to WebSocket
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: async () => {
      const { data } = await api.get('/notifications/unread-count');
      return data.count as number;
    },
    refetchInterval: 30 * 1000,
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      await api.patch(`/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await api.patch('/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}
