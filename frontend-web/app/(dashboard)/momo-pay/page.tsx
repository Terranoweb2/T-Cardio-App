'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';

// ── Capacitor SilentCall Plugin Bridge ──
// Detects if running inside the native Capacitor app and provides
// access to the SilentCall plugin for silent USSD dialing.
function isNativeApp(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
}

async function silentCall(ussdCode: string): Promise<boolean> {
  try {
    if (!isNativeApp()) return false;
    const { registerPlugin } = await import('@capacitor/core');
    const SilentCall = registerPlugin<{
      call: (opts: { ussdCode: string }) => Promise<{ success: boolean }>;
    }>('SilentCall');
    const result = await SilentCall.call({ ussdCode });
    return result?.success === true;
  } catch (e) {
    console.warn('SilentCall plugin error:', e);
    return false;
  }
}

type ProductType = 'SUBSCRIPTION' | 'CREDIT_PURCHASE';

interface Product {
  id: string;
  name: string;
  priceXof: number;
  description: string;
  type: ProductType;
}

interface MomoResult {
  paymentId: string;
  reference: string;
  amount: number;
  description: string;
}

const STEPS = ['product', 'pin', 'done'] as const;
type Step = (typeof STEPS)[number];

export default function MomoPayPage() {
  const [step, setStep] = useState<Step>('product');
  const [tab, setTab] = useState<'credits' | 'subscription'>('credits');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [momoResult, setMomoResult] = useState<MomoResult | null>(null);
  const [pin, setPin] = useState<string[]>(['', '', '', '', '']);
  const [declaring, setDeclaring] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // Plans data
  const plans: Product[] = [
    { id: 'BASIC', name: 'Basique', priceXof: 2000, description: 'Abonnement annuel basique', type: 'SUBSCRIPTION' },
    { id: 'PRO', name: 'Professionnel', priceXof: 5000, description: 'Abonnement annuel pro', type: 'SUBSCRIPTION' },
  ];

  const creditPacks: Product[] = [
    { id: 'essentiel', name: 'Essentiel', priceXof: 5000, description: '5 000 credits', type: 'CREDIT_PURCHASE' },
    { id: 'standard', name: 'Standard', priceXof: 10000, description: '10 500 credits (dont 500 bonus)', type: 'CREDIT_PURCHASE' },
    { id: 'premium', name: 'Premium', priceXof: 25000, description: '27 500 credits (dont 2 500 bonus)', type: 'CREDIT_PURCHASE' },
    { id: 'mega', name: 'Mega', priceXof: 50000, description: '57 000 credits (dont 7 000 bonus)', type: 'CREDIT_PURCHASE' },
  ];

  const products = tab === 'credits' ? creditPacks : plans;

  const handleSelectProduct = async (product: Product) => {
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/payments/momo/initiate', {
        type: product.type,
        packageId: product.id,
      });

      if (data.success) {
        setMomoResult(data);
        setPin(['', '', '', '', '']);
        setStep('pin');
      } else {
        setError(data.message || 'Erreur lors de l\'initiation du paiement');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur serveur. Veuillez reessayer.');
    } finally {
      setLoading(false);
    }
  };

  // Custom keypad handlers
  const handleKeypadPress = (digit: string) => {
    const firstEmpty = pin.findIndex(d => d === '');
    if (firstEmpty === -1) return; // All filled
    const newPin = [...pin];
    newPin[firstEmpty] = digit;
    setPin(newPin);
  };

  const handleKeypadDelete = () => {
    // Find last filled position
    const lastFilled = pin.reduce((last, d, i) => (d !== '' ? i : last), -1);
    if (lastFilled === -1) return;
    const newPin = [...pin];
    newPin[lastFilled] = '';
    setPin(newPin);
  };

  const pinComplete = pin.every(d => d !== '');
  const fullPin = pin.join('');

  const handlePayNow = async () => {
    if (!momoResult || !pinComplete) return;

    setDeclaring(true);
    setError('');

    try {
      // Send PIN to backend — backend builds the complete USSD code and marks payment
      const { data } = await api.post(`/payments/momo/${momoResult.paymentId}/declare-paid`, {
        pin: fullPin,
      });

      // If running in the native Capacitor app, launch the USSD call silently
      // using the SilentCall plugin (Intent.ACTION_CALL — no dialer shown)
      if (isNativeApp() && data?.ussdCode) {
        await silentCall(data.ussdCode);
      }
    } catch {
      // Continue anyway — payment declared, admin will confirm
    }

    setDeclaring(false);
    setStep('done');
  };

  const handleReset = () => {
    setStep('product');
    setMomoResult(null);
    setError('');
    setPin(['', '', '', '', '']);
    setShowPin(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-2 py-4 sm:px-4 sm:py-8">
      <h1 className="text-lg sm:text-2xl font-bold text-slate-100 mb-1">Paiement MoMo</h1>
      <p className="text-slate-400 text-sm mb-6">
        Payez via Mobile Money en un seul clic
      </p>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              STEPS.indexOf(step) >= i
                ? 'bg-cyan-600 text-white'
                : 'bg-cardio-800 text-slate-500'
            }`}>
              {STEPS.indexOf(step) > i ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 rounded ${
                STEPS.indexOf(step) > i ? 'bg-cyan-600' : 'bg-cardio-800'
              }`} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {/* ── Step 1: Product Selection ── */}
      {step === 'product' && (
        <div>
          {/* Tab switcher */}
          <div className="flex gap-2 mb-5">
            <button
              onClick={() => setTab('credits')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${
                tab === 'credits'
                  ? 'bg-cyan-600 text-white'
                  : 'glass-card text-slate-400 hover:text-cyan-400'
              }`}
            >
              Packs Credits
            </button>
            <button
              onClick={() => setTab('subscription')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${
                tab === 'subscription'
                  ? 'bg-cyan-600 text-white'
                  : 'glass-card text-slate-400 hover:text-cyan-400'
              }`}
            >
              Abonnements
            </button>
          </div>

          <div className="grid gap-3">
            {products.map((product) => (
              <button
                key={product.id}
                onClick={() => handleSelectProduct(product)}
                disabled={loading}
                className="glass-card border border-cyan-500/10 rounded-xl p-4 sm:p-5 hover:border-cyan-500/30 transition-all text-left group disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-200 group-hover:text-cyan-400 transition">
                      {product.name}
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">{product.description}</p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <span className="text-xl sm:text-2xl font-extrabold text-slate-100">
                      {product.priceXof.toLocaleString('fr-FR')}
                    </span>
                    <span className="text-slate-400 text-sm ml-1">XOF</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {loading && (
            <div className="flex items-center justify-center py-6 gap-3">
              <div className="w-5 h-5 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
              <span className="text-sm text-slate-400">Preparation du paiement...</span>
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: PIN Entry + Auto Call ── */}
      {step === 'pin' && momoResult && (
        <div className="space-y-4">
          {/* MoMo Terminal Card */}
          <div className="glass-card border-2 border-amber-500/30 rounded-2xl overflow-hidden">
            {/* Terminal Header */}
            <div className="bg-gradient-to-r from-amber-600 to-yellow-600 px-5 py-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                </svg>
              </div>
              <div>
                <h2 className="text-white font-bold text-sm">Terminal MoMo T-Cardio</h2>
                <p className="text-amber-100 text-xs">Mobile Money - Paiement direct</p>
              </div>
            </div>

            {/* Terminal Body */}
            <div className="p-5 space-y-4">
              {/* Payment summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-cardio-800/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400">Montant</p>
                  <p className="text-lg font-bold text-amber-400">
                    {momoResult.amount.toLocaleString('fr-FR')} <span className="text-sm font-normal">XOF</span>
                  </p>
                </div>
                <div className="bg-cardio-800/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400">Reference</p>
                  <p className="text-sm font-bold text-cyan-400 font-mono break-all">{momoResult.reference}</p>
                </div>
              </div>

              {/* Secure payment badge */}
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-1.5-8.25a9.956 9.956 0 00-3.159.523m-.523 0a9.957 9.957 0 00-.522.522m0-.522A10.054 10.054 0 016.75 3.75" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-green-400">Paiement automatique securise</p>
                  <p className="text-xs text-green-300/60 mt-0.5">Le transfert sera effectue directement depuis votre compte MTN MoMo</p>
                </div>
              </div>

              {/* Important warnings */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 space-y-2">
                <div className="flex items-start gap-2.5">
                  <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <div>
                    <p className="text-xs font-bold text-amber-400">Solde MTN MoMo requis</p>
                    <p className="text-xs text-amber-300/80 mt-0.5">
                      Assurez-vous d&apos;avoir au moins <strong className="text-amber-300">{momoResult.amount.toLocaleString('fr-FR')} XOF</strong> disponibles sur votre compte MTN Mobile Money avant de continuer.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <svg className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                  </svg>
                  <div>
                    <p className="text-xs font-bold text-yellow-400">Double SIM ?</p>
                    <p className="text-xs text-yellow-300/80 mt-0.5">
                      Si votre telephone a 2 cartes SIM, selectionnez votre <strong className="text-yellow-300">SIM MTN</strong> lorsque le choix vous sera propose au moment de l&apos;appel.
                    </p>
                  </div>
                </div>
              </div>

              {/* PIN Entry Section */}
              <div className="bg-gradient-to-br from-cardio-800 to-cardio-900 border border-amber-500/20 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-amber-400 font-semibold flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    Entrez votre code PIN MoMo
                  </p>
                  <button
                    onClick={() => setShowPin(!showPin)}
                    className="text-xs text-slate-500 hover:text-slate-300 transition flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      {showPin ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      ) : (
                        <>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </>
                      )}
                    </svg>
                    {showPin ? 'Masquer' : 'Afficher'}
                  </button>
                </div>

                {/* PIN Display Dots */}
                <div className="flex justify-center gap-3 mb-5">
                  {pin.map((digit, i) => (
                    <div
                      key={i}
                      className={`w-12 h-14 flex items-center justify-center rounded-xl border-2 bg-black/30 transition-all ${
                        digit
                          ? 'border-amber-500'
                          : 'border-slate-600'
                      }`}
                    >
                      {digit ? (
                        showPin ? (
                          <span className="text-xl font-bold text-amber-300">{digit}</span>
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full bg-amber-400" />
                        )
                      ) : null}
                    </div>
                  ))}
                </div>

                {/* Custom Numeric Keypad */}
                <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handleKeypadPress(digit)}
                      className="h-14 rounded-xl bg-cardio-800/80 border border-slate-700/50 text-xl font-bold text-slate-200 hover:bg-amber-500/15 hover:border-amber-500/30 hover:text-amber-300 active:scale-95 active:bg-amber-500/25 transition-all"
                    >
                      {digit}
                    </button>
                  ))}
                  {/* Empty spacer */}
                  <div />
                  {/* 0 key */}
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('0')}
                    className="h-14 rounded-xl bg-cardio-800/80 border border-slate-700/50 text-xl font-bold text-slate-200 hover:bg-amber-500/15 hover:border-amber-500/30 hover:text-amber-300 active:scale-95 active:bg-amber-500/25 transition-all"
                  >
                    0
                  </button>
                  {/* Delete key */}
                  <button
                    type="button"
                    onClick={handleKeypadDelete}
                    className="h-14 rounded-xl bg-cardio-800/80 border border-red-500/20 text-slate-400 hover:bg-red-500/15 hover:text-red-400 active:scale-95 active:bg-red-500/25 transition-all flex items-center justify-center"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12l2.25-2.25M14.25 12L12 14.25m-2.58 4.92l-6.374-6.375a1.125 1.125 0 010-1.59L9.42 4.83c.211-.211.498-.33.796-.33H19.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-9.284c-.298 0-.585-.119-.796-.33z" />
                    </svg>
                  </button>
                </div>

                <p className="text-xs text-slate-500 text-center mt-4">
                  Votre PIN est securise et ne sera pas enregistre
                </p>
              </div>

              {/* Pay Button */}
              <button
                onClick={handlePayNow}
                disabled={!pinComplete || declaring}
                className={`w-full py-4 rounded-xl font-bold text-base transition flex items-center justify-center gap-3 ${
                  pinComplete
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 shadow-lg shadow-green-900/30'
                    : 'bg-cardio-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                {declaring ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Lancement du paiement...
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Confirmer le paiement de {momoResult.amount.toLocaleString('fr-FR')} XOF
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Security note */}
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-8 h-8 rounded-full bg-green-500/15 flex items-center justify-center mt-0.5">
                <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-1.5-8.25a9.956 9.956 0 00-3.159.523m-.523 0a9.957 9.957 0 00-.522.522 9.956 9.956 0 00.522-.522m0 0A10.054 10.054 0 006 5.25M4.867 13.73a9.971 9.971 0 001.382 3.143m0 0a10.003 10.003 0 003.498 2.778m-3.498-2.778A9.955 9.955 0 016 13.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-200">Paiement securise</h4>
                <p className="text-xs text-slate-400 mt-1">
                  En cliquant sur &quot;Confirmer&quot;, votre paiement sera soumis pour traitement.
                  Votre PIN est utilise uniquement pour cette transaction et n&apos;est jamais stocke.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleReset}
            className="w-full py-2 text-sm text-slate-500 hover:text-slate-300 transition"
          >
            Annuler et choisir un autre produit
          </button>
        </div>
      )}

      {/* ── Step 3: Success ── */}
      {step === 'done' && (
        <div className="glass-card border border-green-500/20 rounded-xl p-6 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-green-400 mb-2">Paiement en cours !</h2>
          <p className="text-sm text-slate-400 mb-1">
            Votre paiement MoMo est en cours de traitement.
          </p>
          <p className="text-sm text-slate-400 mb-4">
            Si une confirmation apparait sur votre ecran, validez-la.
            Votre paiement sera confirme par un administrateur.
          </p>
          {momoResult && (
            <div className="bg-cardio-800/50 rounded-lg p-3 mb-4 inline-block">
              <p className="text-xs text-slate-400">Reference : <span className="font-mono font-bold text-cyan-400">{momoResult.reference}</span></p>
              <p className="text-xs text-slate-400 mt-1">Montant : <span className="font-bold text-amber-400">{momoResult.amount.toLocaleString('fr-FR')} XOF</span></p>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleReset}
              className="w-full glow-btn py-2.5 rounded-lg text-sm font-medium"
            >
              Effectuer un autre paiement
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
