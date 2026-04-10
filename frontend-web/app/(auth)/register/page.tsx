'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { registerSchema, type RegisterFormData } from '@/lib/validations/auth.schema';

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-cardio-900">
        <div className="text-slate-500">Chargement...</div>
      </div>
    }>
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const [serverError, setServerError] = useState('');
  const [pendingValidation, setPendingValidation] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [registeredRole, setRegisteredRole] = useState('');

  // Detect APK mode: app=patient|medecin|cardiologue|admin
  const appMode = searchParams.get('app');
  const storedAppMode = typeof window !== 'undefined'
    ? (appMode || localStorage.getItem('tcardio_app_mode'))
    : appMode;
  const isCapacitor = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
  const isStandalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);
  // Also detect via User-Agent (our WebView wrapper adds TCardioApp)
  const isTCardioUA = typeof window !== 'undefined' && navigator.userAgent.includes('TCardioApp');
  const isFromAPK = !!storedAppMode || isCapacitor || isStandalone || isTCardioUA;
  // Map APK mode to the correct role — don't assume all native apps are patient
  type RoleType = 'PATIENT' | 'MEDECIN' | 'CARDIOLOGUE';
  const appRoleMap: Record<string, RoleType> = { patient: 'PATIENT', medecin: 'MEDECIN', cardiologue: 'CARDIOLOGUE' };
  const apkRole: RoleType = storedAppMode ? (appRoleMap[storedAppMode] || 'PATIENT') : 'PATIENT';
  const isPatientApp = apkRole === 'PATIENT' && (!!storedAppMode || isCapacitor || isStandalone || isTCardioUA);

  // Store app mode in localStorage when coming from APK
  useEffect(() => {
    if (appMode && typeof window !== 'undefined') {
      localStorage.setItem('tcardio_app_mode', appMode);
    }
  }, [appMode]);

  // Redirect to /download if accessed from web (not from APK)
  useEffect(() => {
    if (typeof window !== 'undefined' && !isFromAPK) {
      router.replace('/download');
    }
  }, [isFromAPK, router]);

  const {
    register: reg,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', confirmPassword: '', role: isFromAPK ? apkRole : 'PATIENT', firstName: '', lastName: '', phone: '', specialty: 'Cardiologie' },
  });

  const selectedRole = watch('role');

  const onSubmit = async (formData: RegisterFormData) => {
    setServerError('');
    try {
      const payload: Record<string, string> = {
        email: formData.email,
        password: formData.password,
        role: formData.role,
      };
      // Include doctor fields if registering as a professional
      if (formData.role === 'MEDECIN' || formData.role === 'CARDIOLOGUE') {
        if (formData.firstName) payload.firstName = formData.firstName;
        if (formData.lastName) payload.lastName = formData.lastName;
        if (formData.phone) payload.phone = formData.phone;
        if (formData.specialty) payload.specialty = formData.specialty;
      }
      const { data } = await api.post('/auth/register', payload);

      // For doctors/cardiologists: show pending validation message instead of login
      if (formData.role === 'MEDECIN' || formData.role === 'CARDIOLOGUE') {
        setRegisteredEmail(formData.email);
        setRegisteredRole(formData.role === 'MEDECIN' ? 'Medecin generaliste' : 'Cardiologue');
        setPendingValidation(true);
        return;
      }

      // For patients: store auth data
      login(data.user, data.accessToken, data.refreshToken);

      // If email was auto-verified (SMTP unavailable), go directly to dashboard
      if (!data.requiresEmailVerification || data.user.emailVerified) {
        router.push('/dashboard');
      } else {
        router.push('/verify-email');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erreur lors de l\'inscription';
      // Translate backend error codes to user-friendly French messages
      const errorMap: Record<string, string> = {
        'ERR_EMAIL_EXISTS': 'Cette adresse email est deja utilisee. Veuillez en choisir une autre ou vous connecter.',
        'ERR_INVALID_PASSWORD': 'Le mot de passe ne respecte pas les criteres requis.',
        'ERR_INVALID_EMAIL': 'Adresse email invalide.',
      };
      let translated = msg;
      for (const [key, val] of Object.entries(errorMap)) {
        if (msg.includes(key)) { translated = val; break; }
      }
      setServerError(translated);
    }
  };

  // ===== Pending validation screen for doctors =====
  if (pendingValidation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cardio-900 px-4 py-8">
        <div className="w-full max-w-lg p-6 sm:p-8 glass-card rounded-xl text-center">
          <div className="mx-auto w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-slate-100 mb-2">Compte cree avec succes !</h1>
          <p className="text-slate-400 text-sm mb-6">
            Votre compte <span className="font-semibold text-slate-300">{registeredRole}</span> a bien ete enregistre.
          </p>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 mb-6 text-left">
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-amber-300 mb-1">Validation requise</h3>
                <p className="text-amber-400 text-sm leading-relaxed">
                  Pour des raisons de securite et de conformite medicale, votre compte doit etre
                  <span className="font-semibold"> valide par un medecin administrateur</span> avant de pouvoir acceder a la plateforme.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-cardio-800/50 rounded-xl p-5 mb-6 text-left">
            <h4 className="font-semibold text-slate-200 text-sm mb-3">Prochaines etapes :</h4>
            <ol className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold">1</span>
                <span className="text-sm text-slate-400">
                  <span className="text-green-400 font-medium">Compte cree</span> — Votre inscription a ete enregistree pour <span className="font-medium text-slate-200">{registeredEmail}</span>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold">2</span>
                <span className="text-sm text-slate-400">
                  <span className="text-amber-400 font-medium">En attente de validation</span> — Un medecin administrateur va verifier votre identite professionnelle
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-slate-700 text-slate-400 flex items-center justify-center text-xs font-bold">3</span>
                <span className="text-sm text-slate-400">
                  <span className="text-slate-400 font-medium">Acces complet</span> — Une fois valide, vous pourrez vous connecter et acceder a toutes les fonctionnalites
                </span>
              </li>
            </ol>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href="/login"
              className="w-full glow-btn py-2.5 rounded-lg transition font-medium text-center inline-block"
            >
              Retour a la page de connexion
            </Link>
            <Link href="/" className="text-sm text-slate-400 hover:text-slate-300 transition">
              Retour a l&apos;accueil
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ===== Registration form =====
  return (
    <div className="min-h-screen flex items-center justify-center bg-cardio-900 px-4 py-8">
      <div className="w-full max-w-md p-6 sm:p-8 glass-card rounded-xl">
        <div className="flex justify-center mb-4">
          <Image src="/logo-T-Cardio.png" alt="T-Cardio Pro" width={80} height={80} priority />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-center text-cyan-400 mb-6">Inscription</h1>

        {serverError && <div className="bg-red-500/10 text-red-400 p-3 rounded-lg mb-4 text-sm">{serverError}</div>}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Hide role selector when launched from a specific APK (role is predetermined) */}
          {!isFromAPK && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Type de compte</label>
              <select
                {...reg('role')}
                className="w-full px-4 py-2 border glass-input rounded-lg"
              >
                <option value="PATIENT">Patient</option>
                <option value="MEDECIN">Medecin generaliste</option>
                <option value="CARDIOLOGUE">Cardiologue</option>
              </select>
              {errors.role && (
                <p className="mt-1 text-xs text-red-400">{errors.role.message}</p>
              )}
            </div>
          )}
          {/* Doctor-specific fields */}
          {(selectedRole === 'MEDECIN' || selectedRole === 'CARDIOLOGUE') && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Prenom *</label>
                  <input
                    type="text"
                    {...reg('firstName')}
                    placeholder="Ex: Jean"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 ${
                      errors.firstName ? 'border-red-400/50 bg-red-500/10' : 'border-cyan-500/20 glass-input'
                    }`}
                  />
                  {errors.firstName && (
                    <p className="mt-1 text-xs text-red-400">{errors.firstName.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Nom *</label>
                  <input
                    type="text"
                    {...reg('lastName')}
                    placeholder="Ex: DUPONT"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 ${
                      errors.lastName ? 'border-red-400/50 bg-red-500/10' : 'border-cyan-500/20 glass-input'
                    }`}
                  />
                  {errors.lastName && (
                    <p className="mt-1 text-xs text-red-400">{errors.lastName.message}</p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Telephone</label>
                <input
                  type="tel"
                  {...reg('phone')}
                  placeholder="Ex: +228 90 00 00 00"
                  className="w-full px-4 py-2 border border-cyan-500/20 glass-input rounded-lg focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Specialite</label>
                <select
                  {...reg('specialty')}
                  className="w-full px-4 py-2 border border-cyan-500/20 glass-input rounded-lg"
                >
                  <option value="Cardiologie">Cardiologie</option>
                  <option value="Medecine generale">Medecine generale</option>
                  <option value="Medecine interne">Medecine interne</option>
                  <option value="Pediatrie">Pediatrie</option>
                  <option value="Neurologie">Neurologie</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <input
              type="email"
              {...reg('email')}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 ${
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
              {...reg('password')}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 ${
                errors.password ? 'border-red-400/50 bg-red-500/10' : 'border-cyan-500/20 glass-input'
              }`}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Confirmer le mot de passe</label>
            <input
              type="password"
              {...reg('confirmPassword')}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 ${
                errors.confirmPassword ? 'border-red-400/50 bg-red-500/10' : 'border-cyan-500/20 glass-input'
              }`}
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-red-400">{errors.confirmPassword.message}</p>
            )}
          </div>

          {/* Doctor/Cardiologist warning banner */}
          {selectedRole !== 'PATIENT' && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2.5">
              <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-300">Validation obligatoire</p>
                <p className="text-xs text-amber-400 mt-0.5 leading-relaxed">
                  Les comptes professionnels de sante necessitent une verification et validation par un medecin administrateur avant activation.
                </p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full glow-btn py-2 rounded-lg disabled:opacity-50 transition font-medium"
          >
            {isSubmitting ? 'Inscription...' : 'Creer mon compte'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-400">
          Deja inscrit ? <Link href="/login" className="text-cyan-400 hover:text-cyan-300">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
