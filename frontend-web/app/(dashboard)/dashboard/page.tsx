'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useMeasurementStats } from '@/hooks/useMeasurements';
import { useChartData, useTrends } from '@/hooks/useAnalytics';
import { useRedeemToken } from '@/hooks/useInvitations';
import { queryKeys } from '@/lib/query-client';
import { getDoctorLabel } from '@/lib/doctor-label';
import ChartWrapper from '@/components/charts/ChartWrapper';
import BpLineChart from '@/components/charts/BpLineChart';
import BpStatsCard from '@/components/charts/BpStatsCard';
import RiskScoreCard from '@/components/risk-score/RiskScoreCard';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const { data: stats } = useMeasurementStats(30);
  const { data: chartData = [] } = useChartData(7);
  const { data: trends } = useTrends(30);
  const { data: latestAi } = useQuery({
    queryKey: queryKeys.ai.latest,
    queryFn: async () => {
      const { data } = await api.get('/ai/latest');
      return data;
    },
  });

  // Token redemption
  const [tokenInput, setTokenInput] = useState('');
  const [tokenMessage, setTokenMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showTokenForm, setShowTokenForm] = useState(true);
  const redeemMutation = useRedeemToken();

  const handleRedeemToken = async () => {
    if (!tokenInput.trim()) return;
    setTokenMessage(null);
    try {
      const result = await redeemMutation.mutateAsync(tokenInput.trim());
      const doctorName = result.doctor
        ? `Dr. ${result.doctor.firstName} ${result.doctor.lastName}`
        : 'votre praticien';
      const roleLabel = getDoctorLabel(result.doctor?.role, result.doctor?.specialty);
      setTokenMessage({
        type: 'success',
        text: `Association reussie avec ${doctorName} (${roleLabel})`,
      });
      setTokenInput('');
      setTimeout(() => setShowTokenForm(false), 3000);
    } catch (err: any) {
      setTokenMessage({
        type: 'error',
        text: err.response?.data?.message || 'Code d\'invitation invalide',
      });
    }
  };

  const riskColors: Record<string, string> = {
    FAIBLE: 'bg-green-500/15 text-green-400',
    MODERE: 'bg-amber-500/15 text-amber-400',
    ELEVE: 'bg-red-500/15 text-red-400',
    CRITIQUE: 'bg-red-500/25 text-red-300',
  };

  return (
    <div className="w-full overflow-hidden">
      <h1 className="text-base sm:text-2xl font-bold mb-2 sm:mb-6 truncate text-slate-100">
        Bonjour{user ? <>, <span className="text-gradient-cyan">{user.email.includes('@') ? user.email.split('@')[0] : user.email}</span></> : ''}
      </h1>

      {/* ==================== TOKEN REDEMPTION CARD ==================== */}
      {showTokenForm && (
        <div className="glass-card rounded-xl p-2.5 sm:p-5 mb-2.5 sm:mb-6 overflow-hidden">
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-10 sm:h-10 bg-cyan-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-xs sm:text-sm text-slate-200 mb-0.5">Associer un praticien</h3>
              <p className="text-[11px] sm:text-xs text-slate-400 mb-2">
                Entrez le code d&apos;invitation fourni par votre praticien pour etablir le suivi.
              </p>
              <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-2">
                <input
                  type="text"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                  placeholder="TC-XXXXXX"
                  maxLength={9}
                  className="flex-1 glass-input rounded-lg px-3 py-1.5 sm:py-2 text-sm font-mono tracking-wider text-center"
                  onKeyDown={(e) => e.key === 'Enter' && handleRedeemToken()}
                />
                <button
                  onClick={handleRedeemToken}
                  disabled={redeemMutation.isPending || !tokenInput.trim()}
                  className="glow-btn px-4 py-1.5 sm:py-2 rounded-lg disabled:opacity-50 text-sm"
                >
                  {redeemMutation.isPending ? 'Validation...' : 'Valider'}
                </button>
              </div>
              {tokenMessage && (
                <p className={`text-xs sm:text-sm mt-1.5 ${tokenMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                  {tokenMessage.text}
                </p>
              )}
            </div>
            <button
              onClick={() => setShowTokenForm(false)}
              className="text-slate-500 hover:text-slate-300 flex-shrink-0 -mt-0.5 transition"
              title="Masquer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 sm:gap-4 mb-3 sm:mb-6">
        <BpStatsCard
          title="Tension moyenne (30j)"
          value={stats ? `${stats.systolic?.avg}/${stats.diastolic?.avg}` : '--/--'}
          subtitle="mmHg"
          trend={trends?.systolic?.direction}
          sparklineData={chartData.map((d: any) => d.systolic)}
          sparklineColor="#06b6d4"
        />
        <BpStatsCard
          title="Nombre de mesures (30j)"
          value={stats?.count?.toString() || '0'}
          sparklineData={chartData.map((d: any) => d.diastolic)}
          sparklineColor="#14b8a6"
        />
        <div className="glass-card p-3.5 sm:p-5 rounded-xl">
          <p className="text-xs sm:text-sm text-slate-400 mb-0.5 sm:mb-1">Niveau de risque</p>
          {latestAi?.riskLevel ? (
            <div>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${riskColors[latestAi.riskLevel] || ''}`}>
                {latestAi.riskLevel}
              </span>
              {latestAi.confidenceScore && (
                <p className="text-xs text-slate-500 mt-2">Confiance: {Math.round(latestAi.confidenceScore * 100)}%</p>
              )}
            </div>
          ) : (
            <p className="text-2xl font-bold text-slate-600">--</p>
          )}
        </div>
      </div>

      {/* Mini BP chart - last 7 days */}
      {chartData.length >= 2 && (
        <div className="mb-6">
          <ChartWrapper
            title="Tendance des 7 derniers jours"
            subtitle="Evolution de votre tension arterielle"
            height="h-56"
          >
            <BpLineChart measurements={chartData} compact showZones={false} />
          </ChartWrapper>
        </div>
      )}

      {/* Risk Score Card */}
      <div className="mb-3 sm:mb-6">
        <RiskScoreCard />
      </div>

      {/* AI Summary */}
      {latestAi?.patientSummary && (
        <div className="glass-card p-6 rounded-xl mb-6">
          <h2 className="text-lg font-semibold mb-3 text-slate-100">Resume T-Cardio</h2>
          <p className="text-slate-300 whitespace-pre-line">{latestAi.patientSummary}</p>
          <p className="text-xs text-slate-500 mt-3">
            Analyse du {new Date(latestAi.createdAt).toLocaleDateString('fr-FR')}
          </p>
        </div>
      )}

      {/* Emergency alert */}
      {stats?.emergencyCount > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl">
          <p className="text-red-400 font-medium">
            {stats.emergencyCount} mesure(s) critique(s) sur les 30 derniers jours
          </p>
        </div>
      )}
    </div>
  );
}
