'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import api from '@/lib/api';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-cardio-900">
        <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get('email') || '';

  const [email, setEmail] = useState(emailFromQuery);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Start with cooldown if coming from forgot-password
  useEffect(() => {
    if (emailFromQuery) {
      setResendCooldown(60);
    }
  }, [emailFromQuery]);

  // Countdown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Focus first code input
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    setError('');
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
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
      setCode(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !email.trim()) return;
    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setResendMessage('Un nouveau code a ete envoye.');
      setResendCooldown(60);
      setError('');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      setTimeout(() => setResendMessage(''), 5000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors du renvoi.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const codeStr = code.join('');
    if (codeStr.length !== 6) {
      setError('Veuillez saisir le code a 6 chiffres.');
      return;
    }
    if (!newPassword) {
      setError('Veuillez saisir un nouveau mot de passe.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        email: email.trim().toLowerCase(),
        code: codeStr,
        newPassword,
      });
      setSuccess(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Code invalide ou expire.');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
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
          <h1 className="text-2xl font-bold text-slate-100 mb-2">Mot de passe modifie !</h1>
          <p className="text-slate-400 text-sm mb-4">
            Votre mot de passe a ete reinitialise avec succes. Vous allez etre redirige vers la page de connexion.
          </p>
          <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cardio-900 px-4 py-8">
      <div className="w-full max-w-md p-6 sm:p-8 glass-card rounded-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <Image src="/logo-T-Cardio.png" alt="T-Cardio Pro" width={72} height={72} priority />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mb-2">Nouveau mot de passe</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Saisissez le code recu par email et choisissez un nouveau mot de passe.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email (read-only if from query) */}
          {!emailFromQuery && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Adresse email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                className="w-full px-4 py-2.5 border border-cyan-500/20 glass-input rounded-xl text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
          )}

          {emailFromQuery && (
            <div className="bg-cardio-800 rounded-xl px-4 py-3 text-center">
              <p className="text-xs text-slate-400">Code envoye a</p>
              <p className="text-sm font-semibold text-cyan-400">{emailFromQuery}</p>
            </div>
          )}

          {/* Code input */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2 text-center">Code de verification</label>
            <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  disabled={loading}
                  className={`w-11 h-14 sm:w-12 sm:h-16 text-center text-xl sm:text-2xl font-bold rounded-xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 ${
                    error && !newPassword
                      ? 'border-red-400/50 bg-red-500/10 text-red-400'
                      : digit
                        ? 'border-cyan-400 bg-cyan-500/10 text-cyan-300'
                        : 'border-cardio-600 bg-cardio-800 text-slate-100'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* New password */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Nouveau mot de passe</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                placeholder="Minimum 8 caracteres"
                className="w-full px-4 py-2.5 border border-cyan-500/20 glass-input rounded-xl text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-400 transition"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
            {newPassword && newPassword.length < 8 && (
              <p className="mt-1 text-xs text-amber-400">Minimum 8 caracteres ({newPassword.length}/8)</p>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Confirmer le mot de passe</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
              placeholder="Retapez le mot de passe"
              className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${
                confirmPassword && confirmPassword !== newPassword
                  ? 'border-red-400/50 bg-red-500/10'
                  : 'border-cyan-500/20 glass-input'
              }`}
            />
            {confirmPassword && confirmPassword !== newPassword && (
              <p className="mt-1 text-xs text-red-400">Les mots de passe ne correspondent pas.</p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Resend message */}
          {resendMessage && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
              <p className="text-sm text-green-400">{resendMessage}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || code.some(d => !d) || !newPassword || newPassword !== confirmPassword}
            className="w-full glow-btn py-3 rounded-xl disabled:opacity-50 transition font-medium text-sm"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Reinitialisation...
              </span>
            ) : (
              'Reinitialiser le mot de passe'
            )}
          </button>
        </form>

        {/* Resend code */}
        <div className="mt-5 text-center">
          <p className="text-sm text-slate-400 mb-1">Code non recu ?</p>
          <button
            onClick={handleResend}
            disabled={resendCooldown > 0 || loading || !email.trim()}
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

        <div className="mt-4 pt-4 border-t border-cyan-500/10 text-center">
          <Link href="/login" className="text-sm text-cyan-400 hover:text-cyan-300 font-medium">
            Retour a la connexion
          </Link>
        </div>
      </div>
    </div>
  );
}
