import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/query-client';

// ── Types ──

export type DeviceType =
  | 'APPLE_HEALTH'
  | 'GOOGLE_FIT'
  | 'WITHINGS'
  | 'OMRON'
  | 'MANUAL_IMPORT'
  | 'OTHER_DEVICE';

export interface Device {
  id: string;
  type: DeviceType;
  name: string;
  deviceId?: string;
  syncConfig?: Record<string, unknown>;
  lastSyncAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SyncRecord {
  systolic: number;
  diastolic: number;
  pulse?: number;
  measuredAt: string;
  context?: string;
}

export interface SyncLog {
  id: string;
  deviceId: string;
  recordsCount: number;
  status: string;
  syncedAt: string;
}

interface CreateDevicePayload {
  type: DeviceType;
  name: string;
  deviceId?: string;
  syncConfig?: Record<string, unknown>;
}

interface SyncPayload {
  deviceId: string;
  records: SyncRecord[];
}

// ── Hooks ──

export function useDevices() {
  return useQuery({
    queryKey: queryKeys.devices.list,
    queryFn: async () => {
      const { data } = await api.get('/devices');
      return data as Device[];
    },
  });
}

export function useDeviceHistory(deviceId: string) {
  return useQuery({
    queryKey: queryKeys.devices.history(deviceId),
    queryFn: async () => {
      const { data } = await api.get(`/devices/${deviceId}/history`);
      return data as SyncLog[];
    },
    enabled: !!deviceId,
  });
}

export function useCreateDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateDevicePayload) => {
      const { data } = await api.post('/devices', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.devices.all });
    },
  });
}

export function useDeleteDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deviceId: string) => {
      await api.delete(`/devices/${deviceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.devices.all });
    },
  });
}

export function useSyncDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ deviceId, records }: SyncPayload) => {
      const { data } = await api.post(`/devices/${deviceId}/sync`, { records });
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.devices.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.devices.history(variables.deviceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.measurements.all });
    },
  });
}
