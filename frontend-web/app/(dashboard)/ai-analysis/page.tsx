'use client';

import { useState } from 'react';
import {
  useLatestAnalysis,
  useRunAnalysis,
  useAnalysisHistory,
} from '@/hooks/useAiAnalysis';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Info,
  ArrowRight,
  Clock,
  FileText,
  Loader2,
  Brain,
  Shield,
  Activity,
} from 'lucide-react';

const riskColors: Record<string, string> = {
  FAIBLE: 'bg-green-500/15 text-green-400 border-green-500/30',
  MODERE: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  ELEVE: 'bg-red-500/15 text-red-400 border-red-500/30',
  CRITIQUE: 'bg-red-700/20 text-red-300 border-red-600/40',
};

const riskBg: Record<string, string> = {
  FAIBLE: 'from-green-500/10 to-green-600/5 border-green-500/20',
  MODERE: 'from-amber-500/10 to-amber-600/5 border-amber-500/20',
  ELEVE: 'from-red-500/10 to-red-600/5 border-red-500/20',
  CRITIQUE: 'from-red-700/15 to-red-800/10 border-red-600/30',
};

const riskBarColor: Record<string, string> = {
  FAIBLE: 'bg-green-400',
  MODERE: 'bg-amber-400',
  ELEVE: 'bg-red-400',
  CRITIQUE: 'bg-red-500',
};

function getTrendIcon(trend: string) {
  if (trend === 'hausse') return <TrendingUp className="w-5 h-5 text-red-400" />;
  if (trend === 'baisse') return <TrendingDown className="w-5 h-5 text-blue-400" />;
  return <Minus className="w-5 h-5 text-green-400" />;
}

function getTrendBorder(trend: string) {
  if (trend === 'hausse') return 'border-l-red-400';
  if (trend === 'baisse') return 'border-l-blue-400';
  return 'border-l-green-400';
}

function getTrendLabel(trend: string) {
  if (trend === 'hausse') return 'En hausse';
  if (trend === 'baisse') return 'En baisse';
  return 'Stable';
}

function getAlertIcon(severity: string) {
  if (severity === 'CRITIQUE' || severity === 'ELEVE') {
    return <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-400" />;
  }
  if (severity === 'MODERE') {
    return <Info className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />;
  }
  return <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-green-400" />;
}

export default function AiAnalysisPage() {
  const { data: analysis, isLoading } = useLatestAnalysis();
  const runAnalysis = useRunAnalysis();
  const [historyPage, setHistoryPage] = useState(1);
  const { data: historyData } = useAnalysisHistory(historyPage);

  const handleRunAnalysis = () => {
    runAnalysis.mutate();
  };

  const isRunning = runAnalysis.isPending;
  const confidencePercent = analysis?.confidenceScore
    ? Math.round(analysis.confidenceScore * 100)
    : 0;

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
        <p className="text-slate-400">Chargement de l&apos;analyse...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6 sm:w-7 sm:h-7 text-cyan-400" />
          <h1 className="text-lg sm:text-2xl font-bold text-gradient-cyan">
            Analyse T-Cardio
          </h1>
        </div>
        <button
          onClick={handleRunAnalysis}
          disabled={isRunning}
          className="glow-btn px-3 py-1.5 sm:px-5 sm:py-2.5 rounded-lg disabled:opacity-50 transition text-xs sm:text-sm font-medium flex items-center gap-2"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyse en cours...
            </>
          ) : (
            <>
              <Activity className="w-4 h-4" />
              Lancer une analyse
            </>
          )}
        </button>
      </div>

      {analysis ? (
        <div className="space-y-6">
          {/* Risk Level Card */}
          <div
            className={`relative overflow-hidden rounded-xl border bg-gradient-to-br p-5 sm:p-8 ${
              riskBg[analysis.riskLevel] || 'from-cardio-800 to-cardio-900 border-cardio-700'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <Shield className="w-10 h-10 sm:w-12 sm:h-12 opacity-80" />
                <div>
                  <p className="text-sm text-slate-400 mb-1">Niveau de risque cardiovasculaire</p>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-semibold border ${
                      riskColors[analysis.riskLevel] || ''
                    }`}
                  >
                    {analysis.riskLevel}
                  </span>
                </div>
              </div>

              {analysis.confidenceScore != null && (
                <div className="sm:text-right">
                  <p className="text-sm text-slate-400 mb-1">Indice de confiance</p>
                  <p className="text-2xl sm:text-3xl font-bold">{confidencePercent}%</p>
                  <div className="w-full sm:w-40 h-2 bg-cardio-800/80 rounded-full mt-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ease-out ${
                        riskBarColor[analysis.riskLevel] || 'bg-cyan-400'
                      }`}
                      style={{ width: `${confidencePercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Patient Summary */}
          {analysis.patientSummary && (
            <div className="glass-card p-4 sm:p-6 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-5 h-5 text-cyan-400" />
                <h2 className="font-semibold text-gradient-cyan">Resume pour vous</h2>
              </div>
              <p className="text-slate-300 whitespace-pre-line leading-relaxed text-sm sm:text-base">
                {analysis.patientSummary}
              </p>
            </div>
          )}

          {/* Recommendations */}
          {analysis.recommendations && analysis.recommendations.length > 0 && (
            <div className="glass-card p-4 sm:p-6 rounded-xl">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-cyan-400" />
                <h2 className="font-semibold text-gradient-cyan">Recommandations</h2>
              </div>
              <ul className="space-y-3">
                {analysis.recommendations.map((rec: string, i: number) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 p-3 bg-cardio-800/50 rounded-lg"
                  >
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-green-400" />
                    <span className="text-sm text-slate-300">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Alerts */}
          {analysis.alerts && analysis.alerts.length > 0 && (
            <div className="glass-card p-4 sm:p-6 rounded-xl">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-cyan-400" />
                <h2 className="font-semibold text-gradient-cyan">Alertes</h2>
              </div>
              <ul className="space-y-3">
                {analysis.alerts.map((alert: any, i: number) => (
                  <li
                    key={i}
                    className={`flex items-start gap-3 p-3 bg-cardio-800/50 rounded-lg border-l-2 transition-colors ${
                      alert.severity === 'CRITIQUE' || alert.severity === 'ELEVE'
                        ? 'border-l-red-400'
                        : alert.severity === 'MODERE'
                          ? 'border-l-amber-400'
                          : 'border-l-green-400'
                    }`}
                  >
                    {getAlertIcon(alert.severity)}
                    <div className="flex-1 min-w-0">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-1 ${
                          riskColors[alert.severity] || ''
                        }`}
                      >
                        {alert.severity}
                      </span>
                      <p className="text-sm text-slate-300">{alert.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Projections */}
          {analysis.projections && (
            <div className="glass-card p-4 sm:p-6 rounded-xl">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
                <h2 className="font-semibold text-gradient-cyan">Projections</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                {['30d', '60d', '90d'].map((period) => {
                  const proj = analysis.projections[period];
                  if (!proj) return null;
                  return (
                    <div
                      key={period}
                      className={`relative p-4 bg-cardio-800/50 rounded-lg border-l-4 ${getTrendBorder(
                        proj.systolic_trend
                      )} transition-all hover:bg-cardio-800/70`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                          {period}
                        </span>
                        {getTrendIcon(proj.systolic_trend)}
                      </div>
                      <p className="text-2xl sm:text-3xl font-bold mb-1">
                        {Math.round(proj.estimated_avg)}
                      </p>
                      <p className="text-xs text-slate-400">mmHg (moy. estimee)</p>
                      <div className="flex items-center gap-1 mt-2">
                        <ArrowRight className="w-3 h-3 text-slate-500" />
                        <span className="text-xs text-slate-400">
                          {getTrendLabel(proj.systolic_trend)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Analysis History */}
          {historyData && historyData.analyses && historyData.analyses.length > 0 && (
            <div className="glass-card p-4 sm:p-6 rounded-xl">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-cyan-400" />
                <h2 className="font-semibold text-gradient-cyan">Historique des analyses</h2>
              </div>
              <div className="space-y-3">
                {historyData.analyses.map((item: any, i: number) => (
                  <div
                    key={item._id || i}
                    className="flex items-center gap-4 p-3 bg-cardio-800/50 rounded-lg hover:bg-cardio-800/70 transition-colors"
                  >
                    <div className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-300">
                        {new Date(item.createdAt).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                        riskColors[item.riskLevel] || ''
                      }`}
                    >
                      {item.riskLevel}
                    </span>
                    {item.confidenceScore != null && (
                      <span className="text-xs text-slate-400 hidden sm:inline">
                        {Math.round(item.confidenceScore * 100)}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {historyData.totalPages > historyPage && (
                <button
                  onClick={() => setHistoryPage((p) => p + 1)}
                  className="mt-4 text-sm text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
                >
                  Voir plus
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Disclaimer */}
          <p className="text-xs text-slate-500 px-1">
            Cette analyse est generee par l&apos;intelligence artificielle de T-Cardio. Elle ne
            remplace pas l&apos;avis de votre medecin traitant ou cardiologue.
            {analysis.createdAt &&
              ` Generee le ${new Date(analysis.createdAt).toLocaleString('fr-FR')}.`}
          </p>
        </div>
      ) : (
        <div className="glass-card p-10 sm:p-16 rounded-xl text-center">
          <Brain className="w-14 h-14 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 mb-2 text-lg">Aucune analyse disponible</p>
          <p className="text-slate-500 text-sm mb-6">
            Lancez votre premiere analyse pour obtenir un bilan cardiovasculaire personnalise.
          </p>
          <button
            onClick={handleRunAnalysis}
            disabled={isRunning}
            className="glow-btn px-6 py-2.5 rounded-lg transition font-medium flex items-center gap-2 mx-auto"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyse en cours...
              </>
            ) : (
              <>
                <Activity className="w-4 h-4" />
                Lancer ma premiere analyse
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
