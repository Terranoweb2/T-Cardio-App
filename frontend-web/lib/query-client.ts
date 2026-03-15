import { QueryClient } from '@tanstack/react-query';

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,     // 30 seconds — data stays fresh
        gcTime: 5 * 60 * 1000,   // 5 minutes — cache kept in memory
        retry: 1,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

// Query key factories for consistent cache keys
export const queryKeys = {
  // Auth
  auth: {
    me: ['auth', 'me'] as const,
  },

  // Patient profile
  patient: {
    profile: ['patient', 'profile'] as const,
  },

  // Measurements
  measurements: {
    all: ['measurements'] as const,
    list: (params: { days?: number; page?: number; limit?: number }) =>
      ['measurements', 'list', params] as const,
    stats: (days: number) => ['measurements', 'stats', days] as const,
  },

  // Analytics
  analytics: {
    all: ['analytics'] as const,
    chartData: (days: number) => ['analytics', 'chart-data', days] as const,
    variability: (days: number) => ['analytics', 'variability', days] as const,
    morningEvening: (days: number) => ['analytics', 'morning-evening', days] as const,
    trends: (days: number) => ['analytics', 'trends', days] as const,
    patientChartData: (patientId: string, days: number) =>
      ['analytics', 'patient', patientId, 'chart-data', days] as const,
  },

  // Notifications
  notifications: {
    all: ['notifications'] as const,
    list: (limit?: number) => ['notifications', 'list', limit] as const,
    unreadCount: ['notifications', 'unread-count'] as const,
  },

  // AI
  ai: {
    latest: ['ai', 'latest'] as const,
    analyses: (page?: number) => ['ai', 'analyses', page] as const,
  },

  // Teleconsultations
  teleconsultations: {
    all: ['teleconsultations'] as const,
    list: (params?: Record<string, unknown>) =>
      ['teleconsultations', 'list', params] as const,
    detail: (id: string) => ['teleconsultations', id] as const,
    messages: (id: string) => ['teleconsultations', id, 'messages'] as const,
  },

  // Reports
  reports: {
    all: ['reports'] as const,
    list: (page?: number) => ['reports', 'list', page] as const,
  },

  // Doctor
  doctor: {
    profile: ['doctor', 'profile'] as const,
    patients: ['doctor', 'patients'] as const,
    patient: (id: string) => ['doctor', 'patients', id] as const,
    invitations: ['doctor', 'invitations'] as const,
    consultationStats: ['doctor', 'consultation-stats'] as const,
  },

  // Admin
  admin: {
    users: (params?: Record<string, unknown>) => ['admin', 'users', params] as const,
    stats: ['admin', 'stats'] as const,
    pendingDoctors: ['admin', 'pending-doctors'] as const,
    payments: (params?: Record<string, unknown>) => ['admin', 'payments', params] as const,
    withdrawals: (params?: Record<string, unknown>) => ['admin', 'withdrawals', params] as const,
    revenue: (days?: number) => ['admin', 'stats', 'revenue', days] as const,
    userGrowth: (days?: number) => ['admin', 'stats', 'user-growth', days] as const,
    subscriptions: ['admin', 'stats', 'subscriptions'] as const,
    topDoctors: ['admin', 'stats', 'top-doctors'] as const,
  },

  // Credits
  credits: {
    balance: ['credits', 'balance'] as const,
    transactions: (page?: number) => ['credits', 'transactions', page] as const,
  },

  // Doctor Wallet
  doctorWallet: {
    stats: ['doctor-wallet', 'stats'] as const,
    transactions: (page?: number) => ['doctor-wallet', 'transactions', page] as const,
    withdrawals: (page?: number) => ['doctor-wallet', 'withdrawals', page] as const,
  },

  // Subscriptions
  subscriptions: {
    me: ['subscriptions', 'me'] as const,
  },

  // Payments
  payments: {
    packages: ['payments', 'packages'] as const,
    plans: ['payments', 'plans'] as const,
    history: (page?: number) => ['payments', 'history', page] as const,
  },

  // Medications
  medications: {
    all: ['medications'] as const,
    list: (isActive?: boolean) => ['medications', 'list', { isActive }] as const,
    today: ['medications', 'today'] as const,
    adherence: (days: number) => ['medications', 'adherence', days] as const,
    detail: (id: string) => ['medications', id] as const,
  },

  // Appointments
  appointments: {
    all: ['appointments'] as const,
    mine: (status?: string) => ['appointments', 'mine', status] as const,
    doctor: (status?: string) => ['appointments', 'doctor', status] as const,
  },

  // Doctors (public / verified list)
  doctors: {
    verified: ['doctors', 'verified'] as const,
    availableSlots: (doctorId: string, date: string) =>
      ['doctors', doctorId, 'available-slots', date] as const,
  },

  // Advertisements
  advertisements: {
    active: ['advertisements', 'active'] as const,
    admin: (params?: Record<string, unknown>) => ['advertisements', 'admin', params] as const,
  },

  // Exam Results
  examResults: {
    all: ['exam-results'] as const,
    list: (type?: string) => ['exam-results', 'list', { type }] as const,
    detail: (id: string) => ['exam-results', id] as const,
  },

  // Family
  family: {
    all: ['family'] as const,
    group: ['family', 'group'] as const,
    memberData: (memberId: string) => ['family', 'member', memberId, 'data'] as const,
  },

  // Connected Devices
  devices: {
    all: ['devices'] as const,
    list: ['devices', 'list'] as const,
    history: (deviceId: string) => ['devices', deviceId, 'history'] as const,
  },

  // Risk Score
  riskScore: {
    all: ['risk-score'] as const,
    latest: ['risk-score', 'latest'] as const,
    history: (limit?: number) => ['risk-score', 'history', limit] as const,
  },

  // Gamification
  gamification: {
    all: ['gamification'] as const,
    profile: ['gamification', 'profile'] as const,
    achievements: ['gamification', 'achievements'] as const,
    badges: ['gamification', 'badges'] as const,
    goals: ['gamification', 'goals'] as const,
    leaderboard: ['gamification', 'leaderboard'] as const,
  },
};
