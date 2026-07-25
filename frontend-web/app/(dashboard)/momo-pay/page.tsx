'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';

// ── Capacitor SilentCall Plugin Bridge (USSD fallback flow only) ──
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
  reference?: string;
  amount: number;
  description?: string;
}

// product → (phone → waiting) for API flow, or (pin) for USSD fallback → done
type Step = 'product' | 'phone' | 'waiting' | 'pin' | 'done';

const MAX_POLLS = 20; // ~60s of polling (3s interval)

export default function MomoPayPage() {
  const [apiEnabled, setApiEnabled] = useState<boolean | null>(null);
  const [step, setStep] = useState<Step>('product');
  const [tab, setTab] = useState<'credits' | 'subscription'>('credits');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [momoResult, setMomoResult] = useState<MomoResult | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  // API flow
  const [msisdn, setMsisdn] = useState('');

  // USSD fallback flow
  const [pin, setPin] = useState<string[]>(['', '', '', '', '']);
  const [declaring, setDeclaring] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // Detect whether the live MTN MoMo API is configured
  useEffect(() => {
    api
      .get('/payments/momo/config')
      .then(({ data }) => setApiEnabled(!!data.apiEnabled))
      .catch(() => setApiEnabled(false));
  }, []);

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

  // Step indicator phase (0 = product, 1 = payment, 2 = done)
  const phaseIndex = step === 'product' ? 0 : step === 'done' ? 2 : 1;
  const phaseLabels = ['Produit', 'Paiement', 'Termine'];

  const handleSelectProduct = async (product: Product) => {
    setError('');
    setSelectedProduct(product);

    // ── Live MTN API flow: collect the payer's phone number next ──
    if (apiEnabled) {
      setMomoResult({ paymentId: '', amount: product.priceXof, description: product.description });
      setStep('phone');
      return;
    }

    // ── USSD fallback flow: create a pending payment, then enter PIN ──
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

  // ── API flow: send a Request to Pay to the payer's MoMo number ──
  const handleRequestToPay = async () => {
    if (!selectedProduct) return;
    const digits = msisdn.replace(/\D/g, '');
    if (digits.length < 8) {
      setError('Numero de telephone invalide. Saisissez votre numero MTN MoMo.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/payments/momo/request-to-pay', {
        type: selectedProduct.type,
        packageId: selectedProduct.id,
        msisdn,
      });
      if (data.success) {
        setMomoResult({
          paymentId: data.paymentId,
          reference: data.referenceId,
          amount: data.amount,
          description: selectedProduct.description,
        });
        setPaymentConfirmed(false);
        setStep('waiting');
      } else {
        setError(data.message || 'Echec de la demande de paiement.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur serveur. Veuillez reessayer.');
    } finally {
      setLoading(false);
    }
  };

  // ── API flow: poll the payment status while the payer approves on their phone ──
  useEffect(() => {
    if (step !== 'waiting' || !momoResult?.paymentId) return;
    let active = true;
    let count = 0;

    const poll = async () => {
      count++;
      try {
        const { data } = await api.post(`/payments/momo/${momoResult.paymentId}/status`);
        if (!active) return;
        if (data.status === 'completed') {
          setPaymentConfirmed(true);
          setStep('done');
          return;
        }
        if (data.status === 'failed') {
          setError('Paiement refuse ou annule sur le telephone. Veuillez reessayer.');
          setStep('phone');
          return;
        }
      } catch {
        // transient — keep polling
      }
      if (!active) return;
      if (count < MAX_POLLS) {
        setTimeout(poll, 3000);
      } else {
        setError(
          'Delai depasse. Si vous avez valide sur votre telephone, le paiement sera confirme sous peu.',
        );
        setStep('phone');
      }
    };

    const t = setTimeout(poll, 3000);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [step, momoResult?.paymentId]);

  // ── USSD fallback: PIN keypad handlers ──
  const handleKeypadPress = (digit: string) => {
    const firstEmpty = pin.findIndex((d) => d === '');
    if (firstEmpty === -1) return;
    const newPin = [...pin];
    newPin[firstEmpty] = digit;
    setPin(newPin);
  };

  const handleKeypadDelete = () => {
    const lastFilled = pin.reduce((last, d, i) => (d !== '' ? i : last), -1);
    if (lastFilled === -1) return;
    const newPin = [...pin];
    newPin[lastFilled] = '';
    setPin(newPin);
  };

  const pinComplete = pin.every((d) => d !== '');
  const fullPin = pin.join('');

  const handlePayNow = async () => {
    if (!momoResult || !pinComplete) return;
    setDeclaring(true);
    setError('');
    try {
      const { data } = await api.post(`/payments/momo/${momoResult.paymentId}/declare-paid`, {
        pin: fullPin,
      });
      if (isNativeApp() && data?.ussdCode) {
        await silentCall(data.ussdCode);
      }
    } catch {
      // Continue anyway — payment declared, admin will confirm
    }
    setDeclaring(false);
    setPaymentConfirmed(false);
    setStep('done');
  };

  const handleReset = () => {
    setStep('product');
    setSelectedProduct(null);
    setMomoResult(null);
    setError('');
    setMsisdn('');
    setPin(['', '', '', '', '']);
    setShowPin(false);
    setPaymentConfirmed(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-2 py-4 sm:px-4 sm:py-8">
      <h1 className="text-lg sm:text-2xl font-bold text-slate-100 mb-1">Paiement MoMo</h1>
      <p className="text-slate-400 text-sm mb-6">
        Payez via Mobile Money en toute securite
      </p>

      {/* Step indicator (3 phases) */}
      <div className="flex items-center gap-2 mb-6">
        {phaseLabels.map((label, i) => (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                phaseIndex >= i ? 'bg-cyan-600 text-white' : 'bg-cardio-800 text-slate-500'
              }`}
            >
              {phaseIndex > i ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            {i < phaseLabels.length - 1 && (
              <div className={`flex-1 h-0.5 rounded ${phaseIndex > i ? 'bg-cyan-600' : 'bg-cardio-800'}`} />
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
          <div className="flex gap-2 mb-5">
            <button
              onClick={() => setTab('credits')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${
                tab === 'credits' ? 'bg-cyan-600 text-white' : 'glass-card text-slate-400 hover:text-cyan-400'
              }`}
            >
              Packs Credits
            </button>
            <button
              onClick={() => setTab('subscription')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${
                tab === 'subscription' ? 'bg-cyan-600 text-white' : 'glass-card text-slate-400 hover:text-cyan-400'
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

      {/* ── Step 2A (API flow): Phone number entry ── */}
      {step === 'phone' && momoResult && (
        <div className="space-y-4">
          <div className="glass-card border-2 border-amber-500/30 rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-amber-600 to-yellow-600 px-5 py-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                </svg>
              </div>
              <div>
                <h2 className="text-white font-bold text-sm">Paiement MTN MoMo</h2>
                <p className="text-amber-100 text-xs">Mobile Money - Validation sur votre telephone</p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-cardio-800/50 rounded-lg p-3 flex items-center justify-between">
                <p className="text-xs text-slate-400">Montant a payer</p>
                <p className="text-lg font-bold text-amber-400">
                  {momoResult.amount.toLocaleString('fr-FR')} <span className="text-sm font-normal">XOF</span>
                </p>
              </div>

              <div>
                <label className="block text-sm text-amber-400 font-semibold mb-2">
                  Votre numero MTN Mobile Money
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={msisdn}
                  onChange={(e) => setMsisdn(e.target.value)}
                  placeholder="07 00 00 00 00"
                  className="w-full bg-cardio-800/80 border border-amber-500/20 rounded-xl px-4 py-3 text-slate-100 text-lg placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Saisissez le numero du compte MoMo a debiter (ex. 07XXXXXXXX).
                </p>
              </div>

              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-green-400">Vous gardez le controle</p>
                  <p className="text-xs text-green-300/70 mt-0.5">
                    MTN vous enverra une demande sur votre telephone. Vous validez avec votre
                    <strong className="text-green-300"> code PIN MoMo</strong> directement chez MTN — il n&apos;est jamais saisi ici.
                  </p>
                </div>
              </div>

              <button
                onClick={handleRequestToPay}
                disabled={loading}
                className={`w-full py-4 rounded-xl font-bold text-base transition flex items-center justify-center gap-3 ${
                  loading
                    ? 'bg-cardio-800 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 shadow-lg shadow-green-900/30'
                }`}
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Envoi de la demande...
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                    </svg>
                    Payer {momoResult.amount.toLocaleString('fr-FR')} XOF
                  </>
                )}
              </button>
            </div>
          </div>

          <button onClick={handleReset} className="w-full py-2 text-sm text-slate-500 hover:text-slate-300 transition">
            Annuler et choisir un autre produit
          </button>
        </div>
      )}

      {/* ── Step 2B (API flow): Waiting for phone validation ── */}
      {step === 'waiting' && momoResult && (
        <div className="glass-card border-2 border-amber-500/30 rounded-2xl p-6 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/15 flex items-center justify-center">
            <div className="w-9 h-9 border-[3px] border-amber-500/20 border-t-amber-400 rounded-full animate-spin" />
          </div>
          <h2 className="text-lg font-bold text-amber-400">Validez sur votre telephone</h2>
          <p className="text-sm text-slate-300">
            Une demande de paiement de{' '}
            <strong className="text-amber-300">{momoResult.amount.toLocaleString('fr-FR')} XOF</strong>{' '}
            a ete envoyee sur votre telephone.
          </p>
          <p className="text-sm text-slate-400">
            Ouvrez la notification MTN MoMo et entrez votre <strong className="text-slate-200">code PIN</strong> pour confirmer.
            La page se mettra a jour automatiquement.
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <div className="w-3 h-3 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
            Verification du paiement en cours...
          </div>
          <button onClick={handleReset} className="w-full py-2 text-sm text-slate-500 hover:text-slate-300 transition">
            Annuler
          </button>
        </div>
      )}

      {/* ── Step 2C (USSD fallback): PIN Entry ── */}
      {step === 'pin' && momoResult && (
        <div className="space-y-4">
          <div className="glass-card border-2 border-amber-500/30 rounded-2xl overflow-hidden">
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

            <div className="p-5 space-y-4">
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
                    {showPin ? 'Masquer' : 'Afficher'}
                  </button>
                </div>

                <div className="flex justify-center gap-3 mb-5">
                  {pin.map((digit, i) => (
                    <div
                      key={i}
                      className={`w-12 h-14 flex items-center justify-center rounded-xl border-2 bg-black/30 transition-all ${
                        digit ? 'border-amber-500' : 'border-slate-600'
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
                  <div />
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('0')}
                    className="h-14 rounded-xl bg-cardio-800/80 border border-slate-700/50 text-xl font-bold text-slate-200 hover:bg-amber-500/15 hover:border-amber-500/30 hover:text-amber-300 active:scale-95 active:bg-amber-500/25 transition-all"
                  >
                    0
                  </button>
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
                  <>Confirmer le paiement de {momoResult.amount.toLocaleString('fr-FR')} XOF</>
                )}
              </button>
            </div>
          </div>

          <button onClick={handleReset} className="w-full py-2 text-sm text-slate-500 hover:text-slate-300 transition">
            Annuler et choisir un autre produit
          </button>
        </div>
      )}

      {/* ── Step 3: Result ── */}
      {step === 'done' && (
        <div
          className={`glass-card rounded-xl p-6 text-center border ${
            paymentConfirmed ? 'border-green-500/30' : 'border-cyan-500/20'
          }`}
        >
          <div
            className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
              paymentConfirmed ? 'bg-green-500/20' : 'bg-cyan-500/15'
            }`}
          >
            <svg
              className={`w-8 h-8 ${paymentConfirmed ? 'text-green-400' : 'text-cyan-400'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          {paymentConfirmed ? (
            <>
              <h2 className="text-lg font-bold text-green-400 mb-2">Paiement confirme !</h2>
              <p className="text-sm text-slate-400 mb-4">
                Votre paiement a ete valide. Votre {selectedProduct?.type === 'SUBSCRIPTION' ? 'abonnement' : 'credit'} est actif.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-cyan-400 mb-2">Paiement en cours !</h2>
              <p className="text-sm text-slate-400 mb-4">
                Votre paiement MoMo est en cours de traitement et sera confirme sous peu.
              </p>
            </>
          )}

          {momoResult && (
            <div className="bg-cardio-800/50 rounded-lg p-3 mb-4 inline-block">
              {momoResult.reference && (
                <p className="text-xs text-slate-400">
                  Reference : <span className="font-mono font-bold text-cyan-400">{momoResult.reference}</span>
                </p>
              )}
              <p className="text-xs text-slate-400 mt-1">
                Montant : <span className="font-bold text-amber-400">{momoResult.amount.toLocaleString('fr-FR')} XOF</span>
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button onClick={handleReset} className="w-full glow-btn py-2.5 rounded-lg text-sm font-medium">
              Effectuer un autre paiement
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
