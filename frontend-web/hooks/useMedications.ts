import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/query-client';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────────────────
export interface Medication {
  id: string;
  name: string;
  dosage?: string;
  frequency: string;
  reminderTimes: string[];
  startDate: string;
  endDate?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TodayChecklistItem {
  medication: Medication;
  reminders: {
    scheduledAt: string;
    status: 'PENDING' | 'TAKEN' | 'SKIPPED' | 'MISSED';
    logId?: string;
  }[];
}

export interface AdherenceStats {
  totalDoses: number;
  taken: number;
  skipped: number;
  missed: number;
  adherencePercent: number;
}

export interface CreateMedicationPayload {
  name: string;
  dosage?: string;
  frequency: string;
  reminderTimes?: string[];
  startDate?: string;
  endDate?: string;
  notes?: string;
}

export interface UpdateMedicationPayload {
  name?: string;
  dosage?: string;
  frequency?: string;
  reminderTimes?: string[];
  startDate?: string;
  endDate?: string;
  notes?: string;
  isActive?: boolean;
}

export interface LogMedicationPayload {
  status: 'TAKEN' | 'SKIPPED';
  scheduledAt: string;
  notes?: string;
}

// ─── Queries ─────────────────────────────────────────────────────────

export function useMedications(isActive?: boolean) {
  return useQuery({
    queryKey: queryKeys.medications.list(isActive),
    queryFn: async () => {
      const params: Record<string, unknown> = {};
      if (isActive !== undefined) params.isActive = isActive;
      const { data } = await api.get('/medications', { params });
      return data as Medication[];
    },
  });
}

export function useTodayChecklist() {
  return useQuery({
    queryKey: queryKeys.medications.today,
    queryFn: async () => {
      const { data } = await api.get('/medications/today');
      return data as TodayChecklistItem[];
    },
    refetchInterval: 60000, // refresh every minute
  });
}

export function useAdherenceStats(days = 7) {
  return useQuery({
    queryKey: queryKeys.medications.adherence(days),
    queryFn: async () => {
      const { data } = await api.get('/medications/adherence', { params: { days } });
      return data as AdherenceStats;
    },
  });
}

export function useMedicationDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.medications.detail(id),
    queryFn: async () => {
      const { data } = await api.get(`/medications/${id}`);
      return data as Medication & { logs: unknown[] };
    },
    enabled: !!id,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────

export function useCreateMedication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateMedicationPayload) => {
      const { data } = await api.post('/medications', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.medications.all });
      toast.success('Medicament ajoute avec succes');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || 'Erreur lors de la creation du medicament';
      toast.error(msg);
    },
  });
}

export function useUpdateMedication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateMedicationPayload & { id: string }) => {
      const { data } = await api.patch(`/medications/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.medications.all });
      toast.success('Medicament mis a jour');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || 'Erreur lors de la mise a jour';
      toast.error(msg);
    },
  });
}

export function useDeleteMedication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/medications/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.medications.all });
      toast.success('Medicament supprime');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || 'Erreur lors de la suppression';
      toast.error(msg);
    },
  });
}

export function useLogMedication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: LogMedicationPayload & { id: string }) => {
      const { data } = await api.post(`/medications/${id}/log`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.medications.today });
      queryClient.invalidateQueries({ queryKey: queryKeys.medications.adherence(7) });
      queryClient.invalidateQueries({ queryKey: queryKeys.medications.adherence(30) });
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || 'Erreur lors de l\'enregistrement';
      toast.error(msg);
    },
  });
}
