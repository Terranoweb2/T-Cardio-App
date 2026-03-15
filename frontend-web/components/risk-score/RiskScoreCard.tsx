'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity, RefreshCw, Loader2, AlertTriangle,
  UserCog, PlusCircle, X, Heart,
} from 'lucide-react';
import RiskGauge from './RiskGauge';
import { useLatestRiskScore, useCalculateRiskScore } from '@/hooks/useRiskScore';

/* ─────────────────────────── Modal types ─────────────────────────── */

interface ModalConfig {
  title: string;
  message: string;
  icon: 'profile' | 'measurement';
  actionLabel: string;
  actionHref: string;
}

/**
 * Determine modal config from an API error message.
 * Returns null if the error doesn't warrant a modal popup.
 */
function getModalConfig(msg: string): ModalConfig | null {
  // Profile incomplete (sex, age, etc.)
  if (/sexe|biologique|profil|genre|date de naissance/i.test(msg)) {
    return {
      title: 'Profil incomplet',
      message: msg,
      icon: 'profile',
      actionLabel: 'Mettre a jour mon profil',
      actionHref: '/profile',
    };
  }
  // No measurements found
  if (/mesure|pression|enregistrer|tension/i.test(msg)) {
    return {
      title: 'Mesures requises',
      message: msg,
      icon: 'measurement',
      actionLabel: 'Ajouter une mesure',
      actionHref: '/measurements/add',
    };
  }
  return null;
}

/* ─────────────────────────── RiskActionModal ─────────────────────────── */

function RiskActionModal({
  config,
  onClose,
}: {
  config: ModalConfig;
  onClose: () => void;
}) {
  const router = useRouter();

  const isProfile = config.icon === 'profile';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal card */}
      <div className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl shadow-cyan-500/10 animate-fadeIn">
        {/* Header */}
        <div
          className={`border-b px-5 py-4 flex items-center justify-between ${
            isProfile
              ? 'bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-red-500/20 border-amber-500/20'
              : 'bg-gradient-to-r from-cyan-500/20 via-teal-500/20 to-cyan-500/20 border-cyan-500/20'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isProfile
                  ? 'bg-amber-500/20 border border-amber-500/30'
                  : 'bg-cyan-500/20 border border-cyan-500/30'
              }`}
            >
              {isProfile ? (
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              ) : (
                <Heart className="w-5 h-5 text-cyan-400" />
              )}
            </div>
            <h3 className="text-base font-bold text-white">{config.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="bg-cardio-900 px-5 py-5">
          <p className="text-sm text-slate-300 leading-relaxed mb-5">
            {config.message}
          </p>

          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => {
                onClose();
                router.push(config.actionHref);
              }}
              className="w-full glow-btn rounded-xl px-5 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-transform hover:scale-[1.02]"
            >
              {isProfile ? (
                <UserCog className="w-4 h-4" />
              ) : (
                <PlusCircle className="w-4 h-4" />
              )}
              {config.actionLabel}
            </button>

            <button
              onClick={onClose}
              className="w-full rounded-xl px-5 py-2.5 text-sm text-slate-400 hover:text-slate-200 hover:bg-cardio-800 transition-all border border-cyan-500/10"
            >
              Plus tard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── RiskScoreCard ─────────────────────────── */

export default function RiskScoreCard() {
  const { data: riskData, isLoading, isError } = useLatestRiskScore();
  const { mutate: calculate, isPending: isCalculating } = useCalculateRiskScore();
  const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);

  // Custom calculate handler that intercepts known errors → shows modal
  const handleCalculate = () => {
    calculate(undefined, {
      onError: (err: any) => {
        const msg =
          err?.response?.data?.message ||
          'Donnees insuffisantes pour le calcul';
        const config = getModalConfig(msg);
        if (config) {
          setModalConfig(config);
        }
      },
    });
  };

  // ---------- Loading ----------
  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-6 flex items-center justify-center min-h-[220px]">
        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
      </div>
    );
  }

  // ---------- No score yet ----------
  if (isError || !riskData) {
    return (
      <>
        <div className="glass-card rounded-xl p-6 flex flex-col items-center justify-center text-center min-h-[220px] gap-4">
          <div className="w-14 h-14 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Activity className="w-7 h-7 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200 mb-1">
              Score de risque cardiovasculaire
            </h3>
            <p className="text-xs text-slate-500 max-w-[240px]">
              Calculez votre score de risque cardiovasculaire a partir de vos
              donnees de sante.
            </p>
          </div>
          <button
            onClick={handleCalculate}
            disabled={isCalculating}
            className="glow-btn rounded-lg px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-60"
          >
            {isCalculating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Calcul en cours...
              </>
            ) : (
              <>
                <Activity className="w-4 h-4" />
                Calculer mon score
              </>
            )}
          </button>
        </div>

        {modalConfig && (
          <RiskActionModal
            config={modalConfig}
            onClose={() => setModalConfig(null)}
          />
        )}
      </>
    );
  }

  // ---------- Has a score ----------
  const calculatedDate = riskData.calculatedAt
    ? new Date(riskData.calculatedAt).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <>
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200">
            Score de risque cardiovasculaire
          </h3>
          <button
            onClick={handleCalculate}
            disabled={isCalculating}
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors disabled:opacity-50"
          >
            {isCalculating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Recalculer
          </button>
        </div>

        <RiskGauge score={riskData.score} riskLevel={riskData.riskLevel} />

        {calculatedDate && (
          <p className="text-[11px] text-slate-500 text-center mt-3">
            Derniere mise a jour : {calculatedDate}
          </p>
        )}
      </div>

      {modalConfig && (
        <RiskActionModal
          config={modalConfig}
          onClose={() => setModalConfig(null)}
        />
      )}
    </>
  );
}
