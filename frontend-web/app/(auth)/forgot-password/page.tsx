'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import api from '@/lib/api';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Veuillez saisir votre adresse email.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setSent(true);
      // Redirect to reset page after short delay
      setTimeout(() => {
        router.push(`/reset-password?email=${encodeURIComponent(email.trim().toLowerCase())}`);
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Une erreur est survenue. Veuillez reessayer.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cardio-900 px-4">
        <div className="w-full max-w-md p-8 glass-card rounded-2xl text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-100 mb-2">Email envoye !</h1>
          <p className="text-slate-400 text-sm mb-4">
            Si un compte existe avec l&apos;adresse <span className="font-semibold text-cyan-400">{email}</span>,
            vous recevrez un code de reinitialisation.
          </p>
          <p className="text-slate-500 text-xs mb-4">Redirection en cours...</p>
          <div className="w-6 h-6 border-3 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cardio-900 px-4 py-8">
      <div className="w-full max-w-md p-6 sm:p-8 glass-card rounded-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image src="/logo-T-Cardio.png" alt="T-Cardio Pro" width={72} height={72} priority />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mb-2">Mot de passe oublie ?</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Saisissez votre adresse email et nous vous enverrons un code pour reinitialiser votre mot de passe.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Adresse email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              placeholder="votre@email.com"
              className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${
                error ? 'border-red-400/50 bg-red-500/10' : 'border-cyan-500/20 glass-input'
              }`}
              autoFocus
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full glow-btn py-3 rounded-xl disabled:opacity-50 transition font-medium text-sm"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Envoi en cours...
              </span>
            ) : (
              'Envoyer le code'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-cyan-400 hover:text-cyan-300 font-medium">
            Retour a la connexion
          </Link>
        </div>
      </div>
    </div>
  );
}
