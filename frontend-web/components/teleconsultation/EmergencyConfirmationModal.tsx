'use client';

import { useCreditBalance } from '@/hooks/useCredits';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import Link from 'next/link';

interface EmergencyConfirmationModalProps {
  onConfirm: (type: 'free' | 'paid') => void;
  onCancel: () => void;
}

export default function EmergencyConfirmationModal({
  onConfirm,
  onCancel,
}: EmergencyConfirmationModalProps) {
  const { data: balanceData } = useCreditBalance();
  const balance = balanceData?.balance ?? 0;
  const hasEnoughCredits = balance >= 1000;

  // Check if patient has at least 1 completed consultation
  const { data: consultations } = useQuery({
    queryKey: ['teleconsultations', 'completed-check'],
    queryFn: async () => {
      const { data } = await api.get('/teleconsultations/patient');
      return data;
    },
    staleTime: 60000,
  });

  const completedCount = (consultations || []).filter(
    (c: any) => c.status === 'ENDED',
  ).length;
  const hasCompletedConsultation = completedCount >= 1;
  const canUsePaidEmergency = hasEnoughCredits && hasCompletedConsultation;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-card rounded-2xl w-full max-w-md">
        {/* Header */}
        <div className="px-6 py-4 border-b border-cyan-500/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center">
              <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Confirmer l&apos;urgence</h2>
              <p className="text-xs text-slate-400 mt-0.5">Choisissez le type d&apos;alerte a envoyer</p>
            </div>
          </div>
        </div>

        {/* Credit balance info */}
        <div className="px-6 pt-4">
          <div className="flex items-center gap-2 text-sm bg-cyan-500/10 rounded-lg px-3 py-2">
            <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-cyan-400">
              Solde: <strong>{balance.toLocaleString('fr-FR')} XOF</strong>
            </span>
          </div>
        </div>

        {/* Body — two choice cards */}
        <div className="px-6 py-5 space-y-3">
          {/* Free emergency */}
          <button
            onClick={() => onConfirm('free')}
            className="w-full text-left p-4 rounded-xl border-2 border-cyan-500/10 hover:border-cyan-400 hover:bg-cyan-500/10 transition-all group"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/15 flex items-center justify-center shrink-0 group-hover:bg-cyan-500/25 transition">
                <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-slate-100 text-sm">Urgence gratuite</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Notification silencieuse envoyee au medecin. Il recevra une alerte visuelle sans son.
                </p>
              </div>
            </div>
          </button>

          {/* Paid emergency */}
          <button
            onClick={() => canUsePaidEmergency && onConfirm('paid')}
            disabled={!canUsePaidEmergency}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all group ${
              canUsePaidEmergency
                ? 'border-red-500/20 hover:border-red-500 bg-red-500/10 hover:bg-red-500/15'
                : 'border-cyan-500/10 bg-cardio-800/50 opacity-60 cursor-not-allowed'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition ${
                canUsePaidEmergency ? 'bg-red-500/15 group-hover:bg-red-500/25' : 'bg-cardio-800'
              }`}>
                <svg className={`w-5 h-5 ${canUsePaidEmergency ? 'text-red-400' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className={`font-semibold text-sm ${canUsePaidEmergency ? 'text-red-400' : 'text-slate-400'}`}>
                    Urgence payante
                  </p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    canUsePaidEmergency ? 'bg-red-500/15 text-red-400' : 'bg-cardio-800 text-slate-400'
                  }`}>
                    1 000 XOF
                  </span>
                </div>
                <p className={`text-xs mt-0.5 ${canUsePaidEmergency ? 'text-red-400' : 'text-slate-500'}`}>
                  Appel insistant avec sonnerie et vibration sur l&apos;appareil du medecin. Alerte repetee.
                </p>

                {/* Disabled reasons */}
                {!hasCompletedConsultation && (
                  <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    Necessaire: au moins 1 consultation terminee
                  </p>
                )}
                {!hasEnoughCredits && (
                  <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    Credits insuffisants.{' '}
                    <Link href="/credits" className="underline font-medium" onClick={onCancel}>
                      Recharger
                    </Link>
                  </p>
                )}
              </div>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-cyan-500/10 flex justify-end">
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-300 px-4 py-2 text-sm transition"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
