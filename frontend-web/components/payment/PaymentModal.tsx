'use client';

import { useState, useEffect, useCallback } from 'react';
import { useInitiatePayment, useVerifyPayment } from '@/hooks/usePayments';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'SUBSCRIPTION' | 'CREDIT_PURCHASE';
  packageId: string;
  packageName: string;
  amount: number;
  description?: string;
  onSuccess?: () => void;
}

type PaymentStep = 'confirm' | 'processing' | 'waiting' | 'success' | 'error';

export default function PaymentModal({
  isOpen,
  onClose,
  type,
  packageId,
  packageName,
  amount,
  description,
  onSuccess,
}: PaymentModalProps) {
  const [step, setStep] = useState<PaymentStep>('confirm');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initiate = useInitiatePayment();
  const verify = useVerifyPayment();

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setStep('confirm');
      setPaymentId(null);
      setError(null);
    }
  }, [isOpen]);

  // Poll payment status
  useEffect(() => {
    if (step !== 'waiting' || !paymentId) return;

    const interval = setInterval(async () => {
      try {
        const result = await verify.mutateAsync(paymentId);
        if (result.status === 'completed') {
          setStep('success');
          onSuccess?.();
          clearInterval(interval);
        } else if (result.status === 'FAILED' || result.status === 'declined') {
          setStep('error');
          setError('Le paiement a echoue. Veuillez reessayer.');
          clearInterval(interval);
        }
      } catch {
        // Polling error — ignore, will retry
      }
    }, 5000); // every 5 seconds

    return () => clearInterval(interval);
  }, [step, paymentId]);

  const handleInitiate = useCallback(async () => {
    setStep('processing');
    setError(null);

    try {
      const result = await initiate.mutateAsync({
        type,
        packageId,
      });

      if (result.success && result.paymentUrl) {
        setPaymentId(result.paymentId);
        // Open FedaPay payment page in new tab
        window.open(result.paymentUrl, '_blank');
        setStep('waiting');
      } else {
        setStep('error');
        setError(result.message || 'Erreur lors de l\'initiation du paiement.');
      }
    } catch (err: any) {
      setStep('error');
      setError(
        err?.response?.data?.message || 'Erreur de connexion. Veuillez reessayer.',
      );
    }
  }, [type, packageId, initiate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-card rounded-2xl max-w-[calc(100vw-2rem)] sm:max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-600 to-teal-600 px-6 py-4">
          <h2 className="text-white text-lg font-semibold">
            {type === 'SUBSCRIPTION' ? 'Souscrire un abonnement' : 'Acheter des credits'}
          </h2>
          <p className="text-cyan-100 text-sm mt-1">{packageName}</p>
        </div>

        <div className="p-6">
          {/* Step: Confirm */}
          {step === 'confirm' && (
            <div>
              <div className="bg-cardio-800/50 rounded-xl p-4 mb-4 border border-cyan-500/10">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-400 text-sm">Produit</span>
                  <span className="font-medium text-sm text-slate-200">{packageName}</span>
                </div>
                {description && (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-400 text-sm">Description</span>
                    <span className="text-slate-300 text-sm">{description}</span>
                  </div>
                )}
                <div className="border-t border-cyan-500/10 pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-200">Total</span>
                    <span className="text-xl font-bold text-cyan-400">
                      {amount.toLocaleString('fr-FR')} XOF
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-500 mb-4">
                Vous serez redirige vers FedaPay pour finaliser le paiement via
                Orange Money, MTN MoMo, Wave ou carte bancaire.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 border border-slate-600 rounded-lg text-slate-300 hover:bg-cardio-700/50 transition text-sm font-medium"
                >
                  Annuler
                </button>
                <button
                  onClick={handleInitiate}
                  className="flex-1 glow-btn px-4 py-2.5 rounded-lg text-sm font-medium"
                >
                  Payer {amount.toLocaleString('fr-FR')} XOF
                </button>
              </div>
            </div>
          )}

          {/* Step: Processing */}
          {step === 'processing' && (
            <div className="text-center py-8">
              <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-300 font-medium">Initialisation du paiement...</p>
              <p className="text-slate-500 text-sm mt-1">Veuillez patienter</p>
            </div>
          )}

          {/* Step: Waiting for payment */}
          {step === 'waiting' && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-amber-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-amber-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-slate-100 font-semibold text-lg mb-2">En attente du paiement</p>
              <p className="text-slate-400 text-sm mb-4">
                Completez votre paiement dans l'onglet FedaPay ouvert.
                Cette page se mettra a jour automatiquement.
              </p>
              <div className="flex items-center justify-center gap-1.5 text-cyan-400 text-sm">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                <span className="ml-2">Verification en cours</span>
              </div>

              <button
                onClick={onClose}
                className="mt-6 text-sm text-slate-500 hover:text-slate-300 transition"
              >
                Fermer (le paiement continuera en arriere-plan)
              </button>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-slate-100 font-semibold text-lg mb-2">Paiement reussi !</p>
              <p className="text-slate-400 text-sm mb-4">
                {type === 'SUBSCRIPTION'
                  ? 'Votre abonnement a ete active avec succes.'
                  : 'Vos credits ont ete ajoutes a votre compte.'}
              </p>
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition text-sm font-medium"
              >
                Fermer
              </button>
            </div>
          )}

          {/* Step: Error */}
          {step === 'error' && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-red-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-slate-100 font-semibold text-lg mb-2">Erreur de paiement</p>
              <p className="text-red-400 text-sm mb-4">{error}</p>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 border border-slate-600 rounded-lg text-slate-300 hover:bg-cardio-700/50 transition text-sm font-medium"
                >
                  Fermer
                </button>
                <button
                  onClick={() => setStep('confirm')}
                  className="flex-1 glow-btn px-4 py-2.5 rounded-lg text-sm font-medium"
                >
                  Reessayer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
