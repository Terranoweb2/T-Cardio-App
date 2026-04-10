import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/query-client';
import toast from 'react-hot-toast';

// ==================== SHARED TYPES ====================

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  scheduledAt: string;
  durationMin?: number;
  reason?: string;
  status: 'APPT_PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';
  rejectionReason?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  doctor?: {
    id: string;
    firstName: string;
    lastName: string;
    specialty: string;
  };
}

export interface VerifiedDoctor {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string;
  role?: string; // 'MEDECIN' | 'CARDIOLOGUE' from user.role
}

// ==================== QUERIES ====================

export function usePatientAppointments(status?: string) {
  return useQuery<Appointment[]>({
    queryKey: queryKeys.appointments.mine(status),
    queryFn: async () => {
      const { data } = await api.get('/appointments/mine', { params: { status } });
      return Array.isArray(data) ? data : data.data || [];
    },
    staleTime: 30 * 1000,
  });
}

export function useDoctorAppointments(status?: string) {
  return useQuery<Appointment[]>({
    queryKey: queryKeys.appointments.doctor(status),
    queryFn: async () => {
      const { data } = await api.get('/appointments/doctor', { params: { status } });
      return Array.isArray(data) ? data : data.data || [];
    },
    staleTime: 30 * 1000,
  });
}

export function useVerifiedDoctors() {
  return useQuery<VerifiedDoctor[]>({
    queryKey: queryKeys.doctors.verified,
    queryFn: async () => {
      const { data } = await api.get('/doctors/verified');
      return Array.isArray(data) ? data : data.data || [];
    },
    staleTime: 60 * 1000,
  });
}

export function useAvailableSlots(doctorId: string, date: string) {
  return useQuery<string[]>({
    queryKey: queryKeys.doctors.availableSlots(doctorId, date),
    queryFn: async () => {
      const { data } = await api.get(`/doctors/${doctorId}/slots`, {
        params: { date },
      });
      // Backend returns [{startTime, endTime}] — extract startTime strings
      if (Array.isArray(data)) {
        return data.map((s: any) => s.startTime || s);
      }
      if (Array.isArray(data?.slots)) {
        return data.slots.map((s: any) => s.startTime || s);
      }
      return [];
    },
    enabled: !!doctorId && !!date,
    staleTime: 30 * 1000,
  });
}

// ==================== MUTATIONS ====================

export function useBookAppointment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      doctorId: string;
      scheduledAt: string;
      reason?: string;
      durationMin?: number;
    }) => {
      const { data } = await api.post('/appointments/book', payload);
      return data;
    },
    onSuccess: () => {
      toast.success('Rendez-vous demande avec succes');
      qc.invalidateQueries({ queryKey: queryKeys.appointments.all });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Erreur lors de la reservation');
    },
  });
}

export function useConfirmAppointment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const { data } = await api.patch(`/appointments/${appointmentId}/confirm`);
      return data;
    },
    onSuccess: () => {
      toast.success('Rendez-vous confirme');
      qc.invalidateQueries({ queryKey: queryKeys.appointments.all });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Erreur lors de la confirmation');
    },
  });
}

export function useRejectAppointment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { appointmentId: string; reason?: string }) => {
      const { data } = await api.patch(`/appointments/${payload.appointmentId}/reject`, {
        reason: payload.reason,
      });
      return data;
    },
    onSuccess: () => {
      toast.success('Rendez-vous rejete');
      qc.invalidateQueries({ queryKey: queryKeys.appointments.all });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Erreur lors du rejet');
    },
  });
}

export function useCancelAppointment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { appointmentId: string; reason?: string }) => {
      const { data } = await api.patch(`/appointments/${payload.appointmentId}/cancel`, {
        reason: payload.reason,
      });
      return data;
    },
    onSuccess: () => {
      toast.success('Rendez-vous annule');
      qc.invalidateQueries({ queryKey: queryKeys.appointments.all });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Erreur lors de l'annulation");
    },
  });
}

export function useDeleteAppointment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const { data } = await api.delete(`/appointments/${appointmentId}`);
      return data;
    },
    onSuccess: () => {
      toast.success('Rendez-vous supprime');
      qc.invalidateQueries({ queryKey: queryKeys.appointments.all });
    },
    onError: (err: any) => {
      // If DELETE endpoint doesn't exist, try cancel instead
      toast.error(err?.response?.data?.message || 'Erreur lors de la suppression');
    },
  });
}
