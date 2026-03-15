import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/query-client';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────────────────

export type ExamType =
  | 'BLOOD_TEST'
  | 'XRAY'
  | 'ECHOCARDIOGRAM'
  | 'HOLTER'
  | 'ECG_EXAM'
  | 'STRESS_TEST'
  | 'DOPPLER'
  | 'SCANNER'
  | 'MRI'
  | 'OTHER_EXAM';

export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  BLOOD_TEST: 'Analyse de sang',
  XRAY: 'Radiographie',
  ECHOCARDIOGRAM: 'Echocardiogramme',
  HOLTER: 'Holter',
  ECG_EXAM: 'ECG',
  STRESS_TEST: "Test d'effort",
  DOPPLER: 'Doppler',
  SCANNER: 'Scanner',
  MRI: 'IRM',
  OTHER_EXAM: 'Autre',
};

export const EXAM_TYPES = Object.keys(EXAM_TYPE_LABELS) as ExamType[];

export interface ExamResult {
  id: string;
  type: ExamType;
  title?: string;
  notes?: string;
  doctorComment?: string;
  fileName?: string;
  mimeType?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UploadExamPayload {
  file: File;
  type: ExamType;
  title?: string;
  notes?: string;
}

// ─── Queries ─────────────────────────────────────────────────────────

export function useExamResults(type?: ExamType) {
  return useQuery({
    queryKey: queryKeys.examResults.list(type),
    queryFn: async () => {
      const params: Record<string, unknown> = {};
      if (type) params.type = type;
      const { data } = await api.get('/exam-results', { params });
      return data as ExamResult[];
    },
  });
}

export function useExamResultDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.examResults.detail(id),
    queryFn: async () => {
      const { data } = await api.get(`/exam-results/${id}`);
      return data as ExamResult;
    },
    enabled: !!id,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────

export function useUploadExamResult() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UploadExamPayload) => {
      const formData = new FormData();
      formData.append('file', payload.file);
      formData.append('type', payload.type);
      if (payload.title) formData.append('title', payload.title);
      if (payload.notes) formData.append('notes', payload.notes);

      const { data } = await api.post('/exam-results/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.examResults.all });
      toast.success('Examen televerse avec succes');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || "Erreur lors du telechargement de l'examen";
      toast.error(msg);
    },
  });
}

export function useDeleteExamResult() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/exam-results/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.examResults.all });
      toast.success('Examen supprime');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || "Erreur lors de la suppression";
      toast.error(msg);
    },
  });
}

export function useAnnotateExamResult() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, doctorComment }: { id: string; doctorComment: string }) => {
      const { data } = await api.patch(`/exam-results/${id}/annotate`, { doctorComment });
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.examResults.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.examResults.detail(variables.id) });
      toast.success('Commentaire ajoute');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || "Erreur lors de l'annotation";
      toast.error(msg);
    },
  });
}

export function useExamFileUrl(id: string) {
  return useQuery({
    queryKey: [...queryKeys.examResults.detail(id), 'file-url'],
    queryFn: async () => {
      const { data } = await api.get(`/exam-results/${id}/file`);
      return data as { url: string };
    },
    enabled: !!id,
  });
}
