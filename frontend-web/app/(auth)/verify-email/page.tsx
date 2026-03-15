'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

export default function VerifyEmailPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setEmailVerified = useAuthStore((s) => s.setEmailVerified);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!user && typeof window !== 'undefined' && !localStorage.getItem('accessToken')) {
      router.push('/login');
    }
  }, [user, router]);

  // Redirect if already verified
  useEffect(() => {
    if (user?.emailVerified) {
      router.push('/dashboard');
    }
  }, [user, router]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Focus first input on load
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only digits

    const newCode = [...code];
    newCode[index] = value.slice(-1); // Take last char
    setCode(newCode);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (newCode.every((d) => d !== '') && value) {
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const newCode = pasted.split('');
      setCode(newCode);
      inputRefs.current[5]?.focus();
      handleVerify(pasted);
    }
  };

  const handleVerify = async (codeStr: string) => {
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/verify-email', { code: codeStr });
      setSuccess(true);
      setEmailVerified();
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('Session expiree. Veuillez vous reconnecter.');
        setTimeout(() => router.push('/login'), 2000);
        return;
      }
      setError(err.response?.data?.message || 'Code invalide');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      const { data } = await api.post('/auth/resend-verification');
      setResendMessage(data.message || 'Code renvoye !');
      setResendCooldown(60);
      setError('');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      setTimeout(() => setResendMessage(''), 5000);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('Session expiree. Veuillez vous reconnecter.');
        setTimeout(() => router.push('/login'), 2000);
        return;
      }
      setError(err.response?.data?.message || 'Erreur lors du renvoi');
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cardio-900 px-4">
        <div className="w-full max-w-md p-8 glass-card rounded-2xl text-center">
          <div className="mx-auto w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mb-2">Email verifie !</h1>
          <p className="text-slate-400 text-sm mb-4">
            Votre adresse email a ete verifiee avec succes. Redirection en cours...
          </p>
          <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cardio-900 px-4">
      <div className="w-full max-w-md p-6 sm:p-8 glass-card rounded-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image src="/logo-T-Cardio.png" alt="T-Cardio Pro" width={72} height={72} priority />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mb-2">Verifiez votre email</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Un code de verification a 6 chiffres a ete envoye a
          </p>
          <p className="text-cyan-400 font-semibold text-sm mt-1">
            {user?.email || '...'}
          </p>
        </div>

        {/* Code input */}
        <div className="flex justify-center gap-2 sm:gap-3 mb-6" onPaste={handlePaste}>
          {code.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              disabled={loading}
              className={`w-11 h-14 sm:w-12 sm:h-16 text-center text-xl sm:text-2xl font-bold rounded-xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 ${
                error
                  ? 'border-red-400/50 bg-red-500/10 text-red-400'
                  : digit
                    ? 'border-cyan-400 bg-cyan-500/10 text-cyan-300'
                    : 'border-cardio-600 bg-cardio-800 text-slate-100'
              }`}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4 text-center">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Resend message */}
        {resendMessage && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 mb-4 text-center">
            <p className="text-sm text-green-400">{resendMessage}</p>
          </div>
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-slate-400">Verification en cours...</span>
          </div>
        )}

        {/* Resend button */}
        <div className="text-center">
          <p className="text-sm text-slate-400 mb-2">Vous n&apos;avez pas recu le code ?</p>
          <button
            onClick={handleResend}
            disabled={resendCooldown > 0 || loading}
            className={`text-sm font-medium transition ${
              resendCooldown > 0
                ? 'text-slate-500 cursor-not-allowed'
                : 'text-cyan-400 hover:text-cyan-300'
            }`}
          >
            {resendCooldown > 0
              ? `Renvoyer dans ${resendCooldown}s`
              : 'Renvoyer le code'}
          </button>
        </div>

        {/* Help text */}
        <div className="mt-8 pt-6 border-t border-cyan-500/10 text-center">
          <p className="text-xs text-slate-500 leading-relaxed">
            Le code est valable 15 minutes. Verifiez vos spams si vous ne le trouvez pas dans votre boite de reception.
          </p>
        </div>
      </div>
    </div>
  );
}
