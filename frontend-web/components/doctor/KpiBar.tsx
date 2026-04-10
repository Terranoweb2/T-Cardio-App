'use client';

import React, { useMemo } from 'react';
import {
  Users,
  AlertTriangle,
  Activity,
  Video,
  BarChart3,
  TrendingUp,
  Bell,
  Star,
} from 'lucide-react';
import ClinicalKpiCard from './ClinicalKpiCard';

interface KpiBarProps {
  patients: any[];
  consultationStats: any;
  teleconsultations: any[];
  unreadCount: number;
  doctorProfile: any;
}

export default function KpiBar({
  patients,
  consultationStats,
  teleconsultations,
  unreadCount,
  doctorProfile,
}: KpiBarProps) {
  const kpis = useMemo(() => {
    const today = new Date().toDateString();

    // 1. Total patients
    const totalPatients = patients.length;

    // 2. Patients at risk (ELEVE or CRITIQUE)
    const atRiskCount = patients.filter(
      (p) =>
        p.lastRiskLevel === 'ELEVE' || p.lastRiskLevel === 'CRITIQUE'
    ).length;

    // 3. Measurements today
    const measurementsToday = patients.filter(
      (p) =>
        p.lastMeasuredAt &&
        new Date(p.lastMeasuredAt).toDateString() === today
    ).length;

    // 4. Pending teleconsultations
    const pendingTeleconsults = teleconsultations.filter(
      (t) => t.status === 'PLANNED'
    ).length;

    // 5. Consultations this month
    const consultationsThisMonth = consultationStats?.thisMonth || 0;

    // 6. Follow-up rate (patients measured within last 7 days)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const followedUp = patients.filter(
      (p) =>
        p.lastMeasuredAt &&
        new Date(p.lastMeasuredAt).getTime() >= sevenDaysAgo
    ).length;
    const followUpRate =
      totalPatients > 0 ? Math.round((followedUp / totalPatients) * 100) : 0;

    // 7. Unread alerts
    const alerts = unreadCount;

    // 8. Satisfaction rating
    const satisfaction = doctorProfile?.averageRating?.toFixed(1) || '--';

    return [
      {
        icon: <Users />,
        title: 'Total patients',
        value: totalPatients,
        accentColor: 'border-l-cyan-500',
        valueColor: 'text-cyan-400',
      },
      {
        icon: <AlertTriangle />,
        title: 'Patients a risque',
        value: atRiskCount,
        accentColor: 'border-l-red-500',
        valueColor: 'text-red-400',
        trend:
          atRiskCount > 0
            ? { direction: 'up' as const, label: 'Vigilance' }
            : undefined,
      },
      {
        icon: <Activity />,
        title: "Mesures aujourd'hui",
        value: measurementsToday,
        accentColor: 'border-l-emerald-500',
        valueColor: 'text-emerald-400',
      },
      {
        icon: <Video />,
        title: 'Teleconsult. en attente',
        value: pendingTeleconsults,
        accentColor: 'border-l-violet-500',
        valueColor: 'text-violet-400',
      },
      {
        icon: <BarChart3 />,
        title: 'Consultations ce mois',
        value: consultationsThisMonth,
        accentColor: 'border-l-blue-500',
        valueColor: 'text-blue-400',
      },
      {
        icon: <TrendingUp />,
        title: 'Taux de suivi',
        value: `${followUpRate}%`,
        accentColor: 'border-l-teal-500',
        valueColor: 'text-teal-400',
        trend:
          followUpRate >= 80
            ? { direction: 'up' as const, label: 'Bon' }
            : followUpRate >= 50
              ? { direction: 'stable' as const, label: 'Moyen' }
              : { direction: 'down' as const, label: 'Faible' },
      },
      {
        icon: <Bell />,
        title: 'Alertes non lues',
        value: alerts,
        accentColor: 'border-l-orange-500',
        valueColor: 'text-orange-400',
        trend:
          alerts > 5
            ? { direction: 'up' as const, label: `${alerts} en attente` }
            : undefined,
      },
      {
        icon: <Star />,
        title: 'Satisfaction',
        value: satisfaction,
        subtitle: '/5',
        accentColor: 'border-l-yellow-500',
        valueColor: 'text-yellow-400',
      },
    ];
  }, [patients, consultationStats, teleconsultations, unreadCount, doctorProfile]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
      {kpis.map((kpi) => (
        <ClinicalKpiCard key={kpi.title} {...kpi} />
      ))}
    </div>
  );
}
