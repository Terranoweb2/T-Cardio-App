'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { loginSchema, type LoginFormData } from '@/lib/validations/auth.schema';

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-cardio-900">
        <div className="text-slate-500">Chargement...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);
  const [serverError, setServerError] = useState('');
  const [isPendingValidation, setIsPendingValidation] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Detect APK mode from query param
  const appMode = searchParams.get('app'); // 'patient', 'medecin', 'admin'

  // Auto-redirect if already authenticated (persistent login)
  useEffect(() => {
    loadFromStorage();
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      const userStr = localStorage.getItem('user');
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr);
          if (user.role === 'ADMIN') router.replace('/admin/dashboard');
          else if (user.role === 'MEDECIN' || user.role === 'CARDIOLOGUE') router.replace('/doctor/dashboard');
          else router.replace('/dashboard');
          return; // Keep splash while redirecting
        } catch {}
      }
      setIsCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    if (appMode && typeof window !== 'undefined') {
      localStorage.setItem('tcardio_app_mode', appMode);
    }
  }, [appMode]);

  const storedAppMode = typeof window !== 'undefined'
    ? (appMode || localStorage.getItem('tcardio_app_mode'))
    : appMode;
  const isCapacitor = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
  const isStandalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);
  const isTCardioUA = typeof window !== 'undefined' && navigator.userAgent.includes('TCardioApp');
  const isFromAPK = !!storedAppMode || isCapacitor || isStandalone || isTCardioUA;
  // Hide register on web (no APK mode) or for medecin/admin apps
  const hideRegister = !isFromAPK || storedAppMode === 'medecin' || storedAppMode === 'admin';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // Translate backend error codes to user-friendly French messages
  const translateError = (message: string): string => {
    const errorMap: Record<string, string> = {
      'ERR_ACCOUNT_PENDING_VALIDATION': 'PENDING_VALIDATION',
      'ERR_ACCOUNT_SUSPENDED': 'Votre compte a ete suspendu. Contactez un administrateur.',
      'ERR_INVALID_CREDENTIALS': 'Email ou mot de passe incorrect.',
      'ERR_ACCOUNT_LOCKED': 'Compte temporairement verrouille suite a trop de tentatives. Reessayez plus tard.',
      'ERR_EMAIL_NOT_VERIFIED': 'Veuillez verifier votre email avant de vous connecter.',
    };
    for (const [key, val] of Object.entries(errorMap)) {
      if (message.includes(key)) {
        if (val === 'PENDING_VALIDATION') {
          setIsPendingValidation(true);
          return '';
        }
        return val;
      }
    }
    return message;
  };

  const onSubmit = async (formData: LoginFormData) => {
    setServerError('');
    setIsPendingValidation(false);
    try {
      const { data } = await api.post('/auth/login', formData);
      login(data.user, data.accessToken, data.refreshToken);

      // Redirect to email verification if not verified
      if (!data.user.emailVerified && data.user.role !== 'ADMIN') {
        router.push('/verify-email');
        return;
      }

      // Validate role matches APK mode
      const currentAppMode = typeof window !== 'undefined' ? localStorage.getItem('tcardio_app_mode') : null;
      if (currentAppMode) {
        const roleMap: Record<string, string[]> = {
          patient: ['PATIENT'],
          medecin: ['MEDECIN', 'CARDIOLOGUE'],
          admin: ['ADMIN'],
        };
        const allowedRoles = roleMap[currentAppMode] || [];
        if (allowedRoles.length > 0 && !allowedRoles.includes(data.user.role)) {
          setServerError(`Cette application est reservee aux ${currentAppMode === 'patient' ? 'patients' : currentAppMode === 'medecin' ? 'medecins' : 'administrateurs'}.`);
          return;
        }
      }

      if (data.user.role === 'ADMIN') router.push('/admin/dashboard');
      else if (data.user.role === 'MEDECIN' || data.user.role === 'CARDIOLOGUE') router.push('/doctor/dashboard');
      else router.push('/dashboard');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Identifiants invalides';
      const translated = translateError(msg);
      if (translated) setServerError(translated);
    }
  };

  // Show splash screen while checking auth (prevents login page flash)
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-cardio-900 flex flex-col items-center justify-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 w-28 h-28 rounded-full bg-cyan-500/15 blur-xl animate-pulse" />
          <div className="relative w-24 h-24 rounded-full bg-cardio-800/80 border border-cyan-500/20 flex items-center justify-center">
            <Image src="/logo-T-Cardio.png" alt="T-Cardio" width={64} height={64} priority />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">T-Cardio <span className="text-cyan-400">Pro</span></h1>
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Chargement...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cardio-900 px-4 py-8">
      <div className="w-full max-w-md p-6 sm:p-8 glass-card rounded-xl">
        <div className="flex justify-center mb-4">
          <Image src="/logo-T-Cardio.png" alt="T-Cardio Pro" width={80} height={80} priority />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-center text-cyan-400 mb-6">Connexion</h1>

        {serverError && <div className="bg-red-500/10 text-red-400 p-3 rounded-lg mb-4 text-sm">{serverError}</div>}

        {/* Pending validation banner */}
        {isPendingValidation && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-amber-300 text-sm">Compte en attente de validation</h3>
                <p className="text-amber-400 text-xs mt-1 leading-relaxed">
                  Votre compte professionnel de sante n&apos;a pas encore ete valide par un medecin administrateur.
                  Vous recevrez un acces des que votre identite professionnelle aura ete verifiee.
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <input
              type="email"
              {...register('email')}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${
                errors.email ? 'border-red-400/50 bg-red-500/10' : 'border-cyan-500/20 glass-input'
              }`}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Mot de passe</label>
            <input
              type="password"
              {...register('password')}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${
                errors.password ? 'border-red-400/50 bg-red-500/10' : 'border-cyan-500/20 glass-input'
              }`}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
            )}
          </div>
          <div className="text-right -mt-1">
            <Link href="/forgot-password" className="text-xs text-cyan-400 hover:text-cyan-300">
              Mot de passe oublie ?
            </Link>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full glow-btn py-2 rounded-lg disabled:opacity-50 transition font-medium"
          >
            {isSubmitting ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        {!hideRegister && (
          <p className="mt-4 text-center text-sm text-slate-400">
            Pas de compte ? <Link href={storedAppMode ? `/register?app=${storedAppMode}` : '/register'} className="text-cyan-400 hover:text-cyan-300">Creer un compte</Link>
          </p>
        )}
        {hideRegister && !isFromAPK && (
          <p className="mt-4 text-center text-sm text-slate-500">
            <Link href="/download" className="text-cyan-400 hover:text-cyan-300">Telechargez l&apos;APK</Link> pour creer un compte.
          </p>
        )}
        {hideRegister && isFromAPK && (
          <p className="mt-4 text-center text-sm text-slate-500">
            Contactez un administrateur pour obtenir un compte.
          </p>
        )}
      </div>
    </div>
  );
}
