'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Heart,
  Pill,
  TrendingUp,
  TrendingDown,
  Minus,
  X,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import api from '@/lib/api';

interface PatientVitalsProps {
  patientId: string;
  isVisible: boolean;
  onToggle: () => void;
}

interface PatientStats {
  avgSystolic: number;
  avgDiastolic: number;
  avgPulse: number;
  latestSystolic: number;
  latestDiastolic: number;
  latestPulse: number;
  systolicTrend: 'rising' | 'falling' | 'stable';
  diastolicTrend: 'rising' | 'falling' | 'stable';
  lastMeasurementDate: string;
  count: number;
}

interface PatientInfo {
  id: string;
  firstName: string;
  lastName: string;
  medicalStatus?: string;
  riskLevel?: 'low' | 'moderate' | 'high' | 'critical';
  medications?: Array<{
    id: string;
    name: string;
    dosage: string;
    frequency: string;
    isActive: boolean;
  }>;
}

// Blood pressure risk color mapping
function getBpColor(systolic: number, diastolic: number): string {
  if (systolic >= 180 || diastolic >= 110) return 'text-red-500';
  if (systolic >= 140 || diastolic >= 90) return 'text-red-400';
  if (systolic >= 130 || diastolic >= 85) return 'text-amber-400';
  if (systolic >= 120 || diastolic >= 80) return 'text-yellow-400';
  return 'text-green-400';
}

function getBpBgColor(systolic: number, diastolic: number): string {
  if (systolic >= 180 || diastolic >= 110) return 'bg-red-500/15 border-red-500/25';
  if (systolic >= 140 || diastolic >= 90) return 'bg-red-500/10 border-red-500/20';
  if (systolic >= 130 || diastolic >= 85) return 'bg-amber-500/10 border-amber-500/20';
  if (systolic >= 120 || diastolic >= 80) return 'bg-yellow-500/10 border-yellow-500/20';
  return 'bg-green-500/10 border-green-500/20';
}

function getRiskBadge(level?: string) {
  switch (level) {
    case 'critical':
      return { label: 'Critique', className: 'bg-red-500/15 text-red-400 border border-red-500/25' };
    case 'high':
      return { label: 'Eleve', className: 'bg-red-500/10 text-red-400 border border-red-500/20' };
    case 'moderate':
      return { label: 'Modere', className: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' };
    case 'low':
      return { label: 'Faible', className: 'bg-green-500/10 text-green-400 border border-green-500/20' };
    default:
      return { label: 'Inconnu', className: 'bg-slate-500/10 text-slate-400 border border-slate-500/20' };
  }
}

function TrendIcon({ trend }: { trend: 'rising' | 'falling' | 'stable' }) {
  if (trend === 'rising') return <TrendingUp className="w-3.5 h-3.5 text-red-400" />;
  if (trend === 'falling') return <TrendingDown className="w-3.5 h-3.5 text-green-400" />;
  return <Minus className="w-3.5 h-3.5 text-slate-500" />;
}

function SkeletonLine({ width = 'w-full' }: { width?: string }) {
  return <div className={`glass-skeleton h-4 rounded ${width}`} />;
}

function SkeletonBlock() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="glass-skeleton w-10 h-10 rounded-full" />
        <div className="space-y-2 flex-1">
          <SkeletonLine width="w-2/3" />
          <SkeletonLine width="w-1/3" />
        </div>
      </div>
      <div className="glass-card rounded-xl p-4 space-y-3">
        <SkeletonLine width="w-1/4" />
        <SkeletonLine width="w-1/2" />
        <SkeletonLine width="w-3/4" />
      </div>
      <div className="glass-card rounded-xl p-4 space-y-3">
        <SkeletonLine width="w-1/3" />
        <SkeletonLine width="w-2/3" />
      </div>
      <div className="glass-card rounded-xl p-4 space-y-3">
        <SkeletonLine width="w-1/4" />
        <SkeletonLine width="w-full" />
        <SkeletonLine width="w-1/2" />
      </div>
    </div>
  );
}

export default function PatientVitals({ patientId, isVisible, onToggle }: PatientVitalsProps) {
  // Fetch patient stats (30 days)
  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery<PatientStats>({
    queryKey: ['patient-stats', patientId],
    queryFn: async () => {
      const { data } = await api.get(`/measurements/patient/${patientId}/stats?days=30`);
      return data;
    },
    enabled: isVisible && !!patientId,
    staleTime: 15_000,
  });

  // Fetch patient info
  const {
    data: patient,
    isLoading: patientLoading,
    refetch: refetchPatient,
  } = useQuery<PatientInfo>({
    queryKey: ['patient-info', patientId],
    queryFn: async () => {
      const { data } = await api.get(`/doctor/patients/${patientId}`);
      return data;
    },
    enabled: isVisible && !!patientId,
    staleTime: 30_000,
  });

  // Auto-refresh every 30 seconds when visible
  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      refetchStats();
      refetchPatient();
    }, 30_000);

    return () => clearInterval(interval);
  }, [isVisible, refetchStats, refetchPatient]);

  const isLoading = statsLoading || patientLoading;
  const activeMedications = patient?.medications?.filter((m) => m.isActive) ?? [];
  const risk = getRiskBadge(patient?.riskLevel);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      {/* Toggle button - sits on the edge of the video call area */}
      {!isVisible && (
        <button
          onClick={onToggle}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-cardio-800/90 backdrop-blur-sm border border-cardio-600/40 border-r-0 rounded-l-xl px-2 py-3 flex flex-col items-center gap-1 hover:bg-cyan-500/10 hover:border-cyan-500/30 transition-all group shadow-lg"
          aria-label="Afficher les constantes du patient"
          title="Constantes du patient"
        >
          <Activity className="w-4 h-4 text-cyan-400 group-hover:text-cyan-300" />
          <ChevronRight className="w-3 h-3 text-slate-500 rotate-180 group-hover:text-cyan-400 transition" />
        </button>
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full z-50 w-full max-w-[320px] bg-cardio-900/95 backdrop-blur-sm border-l border-cardio-600/30 shadow-2xl transition-transform duration-300 ease-in-out ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cardio-700/50">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-slate-200">Constantes patient</h3>
          </div>
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg hover:bg-cardio-700/50 transition text-slate-400 hover:text-slate-200"
            aria-label="Fermer le panneau"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto h-[calc(100%-52px)] px-4 py-4 space-y-4">
          {isLoading ? (
            <SkeletonBlock />
          ) : (
            <>
              {/* Patient name + status */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center text-cyan-400 font-semibold text-sm shrink-0">
                  {patient?.firstName?.[0]}
                  {patient?.lastName?.[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-200 truncate">
                    {patient?.firstName} {patient?.lastName}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {patient?.medicalStatus && (
                      <span className="text-[11px] text-slate-400">
                        {patient.medicalStatus}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Risk level badge */}
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2.5 py-1 rounded-full ${risk.className}`}>
                  Risque : {risk.label}
                </span>
              </div>

              {/* Latest BP */}
              {stats && (
                <div className={`glass-card rounded-xl p-3.5 border ${getBpBgColor(stats.latestSystolic, stats.latestDiastolic)}`}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Heart className="w-3.5 h-3.5 text-red-400" />
                    <p className="text-xs text-slate-400">Derniere mesure</p>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-2xl font-bold ${getBpColor(stats.latestSystolic, stats.latestDiastolic)}`}>
                      {stats.latestSystolic}/{stats.latestDiastolic}
                    </span>
                    <span className="text-xs text-slate-500">mmHg</span>
                  </div>
                  {stats.latestPulse > 0 && (
                    <p className="text-xs text-slate-400 mt-1">
                      Pouls : <span className="text-slate-300">{stats.latestPulse} bpm</span>
                    </p>
                  )}
                </div>
              )}

              {/* Average BP (30 days) */}
              {stats && (
                <div className="glass-card rounded-xl p-3.5">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    <p className="text-xs text-slate-400">Moyenne 30 jours</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xl font-bold ${getBpColor(stats.avgSystolic, stats.avgDiastolic)}`}>
                      {Math.round(stats.avgSystolic)}/{Math.round(stats.avgDiastolic)}
                    </span>
                    <span className="text-xs text-slate-500">mmHg</span>
                    <TrendIcon trend={stats.systolicTrend} />
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    <div className="flex items-center gap-1 text-slate-400">
                      <Heart className="w-3 h-3 text-red-400/60" />
                      <span>Pouls moy. : </span>
                      <span className="text-slate-300">{Math.round(stats.avgPulse)} bpm</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">
                    {stats.count} mesure{stats.count > 1 ? 's' : ''} sur 30 jours
                  </p>
                </div>
              )}

              {/* Last measurement date */}
              {stats?.lastMeasurementDate && (
                <div className="glass-card rounded-xl p-3.5">
                  <p className="text-xs text-slate-400 mb-1">Derniere mesure le</p>
                  <p className="text-sm text-slate-200">
                    {formatDate(stats.lastMeasurementDate)}
                  </p>
                </div>
              )}

              {/* Active medications */}
              <div className="glass-card rounded-xl p-3.5">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <Pill className="w-3.5 h-3.5 text-cyan-400" />
                  <p className="text-xs text-slate-400">
                    Medicaments actifs ({activeMedications.length})
                  </p>
                </div>
                {activeMedications.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Aucun medicament actif</p>
                ) : (
                  <ul className="space-y-2">
                    {activeMedications.map((med) => (
                      <li
                        key={med.id}
                        className="flex items-start gap-2 text-xs"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 mt-1.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-slate-200 font-medium truncate">{med.name}</p>
                          {med.dosage && (
                            <p className="text-slate-500">{med.dosage}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Auto-refresh indicator */}
              <div className="flex items-center justify-center gap-1.5 pt-2">
                <Loader2 className="w-3 h-3 text-slate-600 animate-spin" />
                <p className="text-[10px] text-slate-600">Actualisation auto. toutes les 30s</p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
