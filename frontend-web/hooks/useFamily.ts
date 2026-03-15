import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/query-client';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────────────────

export interface FamilyMember {
  id: string;
  userId: string;
  role: 'OWNER' | 'MEMBER';
  user: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
  joinedAt: string;
}

export interface FamilyInvitation {
  id: string;
  email: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED';
  token: string;
  createdAt: string;
}

export interface FamilyGroup {
  id: string;
  name: string;
  members: FamilyMember[];
  invitations?: FamilyInvitation[];
  createdAt: string;
}

export interface MemberHealthData {
  measurements?: {
    latest?: {
      systolic: number;
      diastolic: number;
      pulse?: number;
      measuredAt: string;
      riskLevel?: string;
    };
    count: number;
    averageSystolic?: number;
    averageDiastolic?: number;
  };
  medications?: {
    active: {
      id: string;
      name: string;
      dosage?: string;
      frequency: string;
    }[];
    count: number;
  };
}

// ─── Queries ─────────────────────────────────────────────────────────

export function useFamilyGroup() {
  return useQuery({
    queryKey: queryKeys.family.group,
    queryFn: async () => {
      const { data } = await api.get('/family');
      return data as FamilyGroup | null;
    },
  });
}

export function useMemberHealthData(memberId: string) {
  return useQuery({
    queryKey: queryKeys.family.memberData(memberId),
    queryFn: async () => {
      const { data } = await api.get(`/family/members/${memberId}/data`);
      return data as MemberHealthData;
    },
    enabled: !!memberId,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────

export function useCreateFamilyGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.post('/family', { name });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.family.all });
      toast.success('Groupe familial cree avec succes');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || 'Erreur lors de la creation du groupe';
      toast.error(msg);
    },
  });
}

export function useInviteFamilyMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (email: string) => {
      const { data } = await api.post('/family/invite', { email });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.family.all });
      toast.success('Invitation envoyee');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || "Erreur lors de l'envoi de l'invitation";
      toast.error(msg);
    },
  });
}

export function useAcceptFamilyInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      const { data } = await api.post(`/family/accept/${token}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.family.all });
      toast.success('Invitation acceptee ! Bienvenue dans le groupe familial');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || "Erreur lors de l'acceptation de l'invitation";
      toast.error(msg);
    },
  });
}

export function useRemoveFamilyMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberId: string) => {
      const { data } = await api.delete(`/family/members/${memberId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.family.all });
      toast.success('Membre retire du groupe');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || 'Erreur lors de la suppression du membre';
      toast.error(msg);
    },
  });
}
