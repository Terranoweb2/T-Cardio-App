'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/query-client';
import {
  Settings, Loader2, Save, CheckCircle, AlertCircle,
  Video, MessageSquare, Siren, Percent, Info,
} from 'lucide-react';

interface DoctorPricing {
  consultationPriceXof: number | null;
  messagingPriceXof: number;
  emergencyPriceXof: number;
  platformCommissionPct: number;
}

export default function DoctorPricingPage() {
  const queryClient = useQueryClient();

  // Form state
  const [consultationPrice, setConsultationPrice] = useState('5000');
  const [messagingPrice, setMessagingPrice] = useState('0');
  const [emergencyPrice, setEmergencyPrice] = useState('1000');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Fetch current profile (includes pricing fields)
  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.doctor.profile,
    queryFn: async () => {
      const { data } = await api.get('/doctors/profile');
      return data as DoctorPricing & Record<string, unknown>;
    },
    staleTime: 60 * 1000,
  });

  // Populate form from loaded profile
  useEffect(() => {
    if (profile) {
      setConsultationPrice(String(profile.consultationPriceXof ?? 5000));
      setMessagingPrice(String(profile.messagingPriceXof ?? 0));
      setEmergencyPrice(String(profile.emergencyPriceXof ?? 1000));
    }
  }, [profile]);

  // Mutation
  const pricingMutation = useMutation({
    mutationFn: async (payload: {
      consultationPriceXof?: number;
      messagingPriceXof?: number;
      emergencyPriceXof?: number;
    }) => {
      const { data } = await api.patch('/doctors/me/pricing', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.doctor.profile });
      setSaveSuccess(true);
      setSaveError('');
      setTimeout(() => setSaveSuccess(false), 4000);
    },
    onError: (err: any) => {
      setSaveError(err.response?.data?.message || 'Erreur lors de la sauvegarde');
      setSaveSuccess(false);
    },
  });

  const handleSave = () => {
    const consultation = parseInt(consultationPrice, 10);
    const messaging = parseInt(messagingPrice, 10);
    const emergency = parseInt(emergencyPrice, 10);

    if (isNaN(consultation) || consultation < 1000) {
      setSaveError('Le tarif de teleconsultation doit etre au minimum 1 000 XOF');
      return;
    }
    if (isNaN(messaging) || messaging < 0) {
      setSaveError('Le tarif de messagerie ne peut pas etre negatif');
      return;
    }
    if (isNaN(emergency) || emergency < 0) {
      setSaveError('Le tarif d\'urgence ne peut pas etre negatif');
      return;
    }

    setSaveError('');
    pricingMutation.mutate({
      consultationPriceXof: consultation,
      messagingPriceXof: messaging,
      emergencyPriceXof: emergency,
    });
  };

  // Compute doctor earnings preview (after platform commission)
  const commissionPct = profile?.platformCommissionPct ?? 20;
  const previewConsultation = Math.round(
    (parseInt(consultationPrice, 10) || 0) * (1 - commissionPct / 100)
  );
  const previewMessaging = Math.round(
    (parseInt(messagingPrice, 10) || 0) * (1 - commissionPct / 100)
  );
  const previewEmergency = Math.round(
    (parseInt(emergencyPrice, 10) || 0) * (1 - commissionPct / 100)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gradient-cyan flex items-center gap-2">
          <Settings className="w-6 h-6 text-cyan-400" />
          Mes Tarifs
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Definissez vos tarifs pour les teleconsultations, la messagerie et les urgences.
          Les patients verront ces prix avant de vous contacter.
        </p>
      </div>

      {/* Success / Error banners */}
      {saveSuccess && (
        <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          Tarifs mis a jour avec succes !
        </div>
      )}
      {saveError && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {saveError}
        </div>
      )}

      {/* Commission info */}
      <div className="mb-6 p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/15 flex items-start gap-3">
        <Percent className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-slate-200">Commission plateforme : {commissionPct}%</p>
          <p className="text-xs text-slate-400 mt-1">
            La plateforme retient {commissionPct}% sur chaque transaction. Les montants nets que vous percevez sont affiches a droite de chaque tarif.
          </p>
        </div>
      </div>

      {/* Pricing cards */}
      <div className="space-y-4">

        {/* Teleconsultation */}
        <div className="glass-card rounded-xl border border-cyan-500/10 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-cyan-500/10 bg-cardio-800/30">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Video className="w-5 h-5 text-green-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-slate-100">Teleconsultation</h2>
              <p className="text-xs text-slate-400">Appel video avec un patient</p>
            </div>
          </div>
          <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                Prix par consultation (XOF)
              </label>
              <input
                type="number"
                value={consultationPrice}
                onChange={(e) => setConsultationPrice(e.target.value)}
                min={1000}
                step={500}
                className="w-full glass-input rounded-lg px-3 py-2.5 text-sm font-mono"
                placeholder="5000"
              />
              <p className="text-[11px] text-slate-500 mt-1">Minimum : 1 000 XOF</p>
            </div>
            <div className="sm:w-48 p-3 rounded-lg bg-green-500/5 border border-green-500/15 text-center">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider mb-1">Vous recevez</p>
              <p className="text-xl font-bold text-green-400 font-mono">
                {previewConsultation.toLocaleString('fr-FR')} <span className="text-xs font-normal">XOF</span>
              </p>
            </div>
          </div>
        </div>

        {/* Messagerie */}
        <div className="glass-card rounded-xl border border-cyan-500/10 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-cyan-500/10 bg-cardio-800/30">
            <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-violet-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-slate-100">Messagerie</h2>
              <p className="text-xs text-slate-400">Discussion ecrite avec un patient (session de 24h)</p>
            </div>
          </div>
          <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                Prix par session (XOF)
              </label>
              <input
                type="number"
                value={messagingPrice}
                onChange={(e) => setMessagingPrice(e.target.value)}
                min={0}
                step={100}
                className="w-full glass-input rounded-lg px-3 py-2.5 text-sm font-mono"
                placeholder="0"
              />
              <div className="flex items-start gap-1.5 mt-1.5">
                <Info className="w-3 h-3 text-slate-500 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-500">
                  Mettez 0 pour offrir la messagerie gratuite. Chaque session dure 24h a partir du premier message du patient.
                </p>
              </div>
            </div>
            <div className="sm:w-48 p-3 rounded-lg bg-violet-500/5 border border-violet-500/15 text-center">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider mb-1">Vous recevez</p>
              {parseInt(messagingPrice, 10) === 0 ? (
                <p className="text-base font-semibold text-violet-400">Gratuit</p>
              ) : (
                <p className="text-xl font-bold text-violet-400 font-mono">
                  {previewMessaging.toLocaleString('fr-FR')} <span className="text-xs font-normal">XOF</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Urgences */}
        <div className="glass-card rounded-xl border border-cyan-500/10 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-cyan-500/10 bg-cardio-800/30">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Siren className="w-5 h-5 text-orange-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-slate-100">Urgences</h2>
              <p className="text-xs text-slate-400">Appel d'urgence d'un patient</p>
            </div>
          </div>
          <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                Prix par urgence (XOF)
              </label>
              <input
                type="number"
                value={emergencyPrice}
                onChange={(e) => setEmergencyPrice(e.target.value)}
                min={0}
                step={500}
                className="w-full glass-input rounded-lg px-3 py-2.5 text-sm font-mono"
                placeholder="1000"
              />
              <p className="text-[11px] text-slate-500 mt-1">Mettez 0 pour offrir les urgences gratuites</p>
            </div>
            <div className="sm:w-48 p-3 rounded-lg bg-orange-500/5 border border-orange-500/15 text-center">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider mb-1">Vous recevez</p>
              {parseInt(emergencyPrice, 10) === 0 ? (
                <p className="text-base font-semibold text-orange-400">Gratuit</p>
              ) : (
                <p className="text-xl font-bold text-orange-400 font-mono">
                  {previewEmergency.toLocaleString('fr-FR')} <span className="text-xs font-normal">XOF</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={pricingMutation.isPending}
          className="glow-btn flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition disabled:opacity-50"
        >
          {pricingMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {pricingMutation.isPending ? 'Enregistrement...' : 'Enregistrer mes tarifs'}
        </button>
      </div>

      {/* Summary table */}
      <div className="mt-8 glass-card rounded-xl border border-cyan-500/10 overflow-hidden">
        <div className="px-5 py-3 border-b border-cyan-500/10 bg-cardio-800/30">
          <h3 className="text-sm font-semibold text-slate-200">Resume de vos tarifs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cyan-500/10">
                <th className="text-left px-5 py-2.5 text-xs text-slate-400 font-medium uppercase tracking-wider">Service</th>
                <th className="text-right px-5 py-2.5 text-xs text-slate-400 font-medium uppercase tracking-wider">Prix patient</th>
                <th className="text-right px-5 py-2.5 text-xs text-slate-400 font-medium uppercase tracking-wider">Commission ({commissionPct}%)</th>
                <th className="text-right px-5 py-2.5 text-xs text-slate-400 font-medium uppercase tracking-wider">Vous recevez</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyan-500/10">
              <tr className="hover:bg-cardio-800/30">
                <td className="px-5 py-3 text-slate-300 flex items-center gap-2">
                  <Video className="w-4 h-4 text-green-400" />
                  Teleconsultation
                </td>
                <td className="px-5 py-3 text-right text-slate-200 font-mono">
                  {(parseInt(consultationPrice, 10) || 0).toLocaleString('fr-FR')} XOF
                </td>
                <td className="px-5 py-3 text-right text-slate-400 font-mono">
                  -{Math.round((parseInt(consultationPrice, 10) || 0) * commissionPct / 100).toLocaleString('fr-FR')} XOF
                </td>
                <td className="px-5 py-3 text-right text-green-400 font-bold font-mono">
                  {previewConsultation.toLocaleString('fr-FR')} XOF
                </td>
              </tr>
              <tr className="hover:bg-cardio-800/30">
                <td className="px-5 py-3 text-slate-300 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-violet-400" />
                  Messagerie (24h)
                </td>
                <td className="px-5 py-3 text-right text-slate-200 font-mono">
                  {parseInt(messagingPrice, 10) === 0 ? 'Gratuit' : `${(parseInt(messagingPrice, 10) || 0).toLocaleString('fr-FR')} XOF`}
                </td>
                <td className="px-5 py-3 text-right text-slate-400 font-mono">
                  {parseInt(messagingPrice, 10) === 0 ? '-' : `-${Math.round((parseInt(messagingPrice, 10) || 0) * commissionPct / 100).toLocaleString('fr-FR')} XOF`}
                </td>
                <td className="px-5 py-3 text-right text-violet-400 font-bold font-mono">
                  {parseInt(messagingPrice, 10) === 0 ? 'Gratuit' : `${previewMessaging.toLocaleString('fr-FR')} XOF`}
                </td>
              </tr>
              <tr className="hover:bg-cardio-800/30">
                <td className="px-5 py-3 text-slate-300 flex items-center gap-2">
                  <Siren className="w-4 h-4 text-orange-400" />
                  Urgence
                </td>
                <td className="px-5 py-3 text-right text-slate-200 font-mono">
                  {parseInt(emergencyPrice, 10) === 0 ? 'Gratuit' : `${(parseInt(emergencyPrice, 10) || 0).toLocaleString('fr-FR')} XOF`}
                </td>
                <td className="px-5 py-3 text-right text-slate-400 font-mono">
                  {parseInt(emergencyPrice, 10) === 0 ? '-' : `-${Math.round((parseInt(emergencyPrice, 10) || 0) * commissionPct / 100).toLocaleString('fr-FR')} XOF`}
                </td>
                <td className="px-5 py-3 text-right text-orange-400 font-bold font-mono">
                  {parseInt(emergencyPrice, 10) === 0 ? 'Gratuit' : `${previewEmergency.toLocaleString('fr-FR')} XOF`}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
