'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { queryKeys } from '@/lib/query-client';
import { usePatientUpdates } from '@/hooks/usePatientUpdates';
import { useDoctorProfile } from '@/hooks/useDoctorProfile';
import { useChartData, useMorningEvening } from '@/hooks/useAnalytics';
import KpiBar from '@/components/doctor/KpiBar';
import ActivityTimeline from '@/components/doctor/ActivityTimeline';
import PatientOverviewPanel from '@/components/doctor/PatientOverviewPanel';
import AnalyticsRow from '@/components/doctor/AnalyticsRow';
import AgendaTeleconsultation from '@/components/doctor/AgendaTeleconsultation';
import AlertsUrgentActions from '@/components/doctor/AlertsUrgentActions';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Stethoscope } from 'lucide-react';

export default function DoctorDashboardPage() {
  const user = useAuthStore((s) => s.user);

  // Real-time patient updates via WebSocket
  usePatientUpdates();

  // ─── Core data queries ───

  const { data: patients = [], isLoading: patientsLoading } = useQuery({
    queryKey: queryKeys.doctor.patients,
    queryFn: async () => {
      const { data } = await api.get('/doctors/patients');
      return data.data || data;
    },
  });

  const { data: doctorProfile } = useDoctorProfile();

  const { data: consultationStats } = useQuery({
    queryKey: queryKeys.doctor.consultationStats,
    queryFn: async () => {
      const { data } = await api.get('/doctors/consultation-stats');
      return data.data || data;
    },
  });

  const { data: notifications = [] } = useQuery({
    queryKey: queryKeys.notifications.list(50),
    queryFn: async () => {
      const { data } = await api.get('/notifications', { params: { limit: 50 } });
      return data.data || data;
    },
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: async () => {
      const { data } = await api.get('/notifications/unread-count');
      return data.count ?? data.data?.count ?? data ?? 0;
    },
  });

  const { data: teleconsultations = [] } = useQuery({
    queryKey: queryKeys.teleconsultations.list({ role: 'doctor' }),
    queryFn: async () => {
      const { data } = await api.get('/teleconsultations/doctor');
      return data.data || data || [];
    },
  });

  const { data: appointments = [] } = useQuery({
    queryKey: queryKeys.appointments.doctor(),
    queryFn: async () => {
      const { data } = await api.get('/appointments/doctor');
      return data.data || data || [];
    },
  });

  // Analytics
  const { data: chartData } = useChartData(30);
  const { data: morningEvening } = useMorningEvening(30);

  // ─── Header ───

  const today = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });
  const greeting = new Date().getHours() < 12 ? 'Bonjour' : new Date().getHours() < 18 ? 'Bon après-midi' : 'Bonsoir';

  // ─── Loading state ───

  if (patientsLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 bg-cardio-800/50 rounded animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass-card rounded-lg p-3 h-24 animate-pulse bg-cardio-800/30" />
          ))}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          <div className="xl:col-span-3 glass-card rounded-lg h-96 animate-pulse bg-cardio-800/30" />
          <div className="xl:col-span-2 glass-card rounded-lg h-96 animate-pulse bg-cardio-800/30" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 page-transition">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-cyan-400" />
            {greeting}, Dr. {doctorProfile?.user?.lastName || user?.email?.split('@')[0] || ''}
          </h1>
          <p className="text-xs text-slate-500 mt-1 capitalize">{today}</p>
        </div>
      </div>

      {/* ─── Section 1: KPI Bar ─── */}
      <KpiBar
        patients={patients}
        consultationStats={consultationStats}
        teleconsultations={teleconsultations}
        unreadCount={unreadCount}
        doctorProfile={doctorProfile}
      />

      {/* ─── Section 2 + 3: Activity Timeline + Patient Panel ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3">
          <ActivityTimeline notifications={notifications} patients={patients} />
        </div>
        <div className="xl:col-span-2">
          <PatientOverviewPanel patients={patients} />
        </div>
      </div>

      {/* ─── Section 4: Analytics ─── */}
      <AnalyticsRow
        patients={patients}
        chartData={chartData}
        morningEvening={morningEvening}
        consultationStats={consultationStats}
      />

      {/* ─── Section 5: Agenda & Teleconsultation ─── */}
      <AgendaTeleconsultation
        appointments={appointments}
        teleconsultations={teleconsultations}
      />

      {/* ─── Section 6: Alerts & Urgent Actions ─── */}
      <AlertsUrgentActions patients={patients} />
    </div>
  );
}
