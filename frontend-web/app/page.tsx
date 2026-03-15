'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

/* ───── DATA ───── */

const features = [
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    title: 'Teleconsultation Video HD',
    desc: 'Appels video chiffres de bout en bout avec chat integre, partage de documents medicaux et enregistrement securise.',
    color: 'cyan',
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    ),
    title: 'Suivi Cardiaque Continu',
    desc: 'ECG en temps reel, tension arterielle, frequence cardiaque et saturation en oxygene avec graphiques d\'evolution.',
    color: 'red',
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
    ),
    title: 'Alertes Intelligentes',
    desc: 'Detection automatique des anomalies tensionnelles et cardiaques avec notifications push instantanees au medecin.',
    color: 'amber',
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z" />
      </svg>
    ),
    title: 'Urgences par IA',
    desc: 'Systeme d\'urgence avec score de risque automatique par intelligence artificielle, cooldown anti-abus et rappel securise.',
    color: 'rose',
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    title: 'Ordonnances Numeriques',
    desc: 'Redaction, generation PDF et envoi instantane des prescriptions medicales au patient via l\'application.',
    color: 'violet',
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
    title: 'Paiement Mobile Money',
    desc: 'Credits prepaid, recharge via Orange Money / Mobile Money et portefeuille medecin transparent avec retrait facile.',
    color: 'emerald',
  },
];

const steps = [
  { num: '01', title: 'Telechargez l\'APK', desc: 'Installez l\'application sur votre telephone Android.', icon: '📱' },
  { num: '02', title: 'Creez votre compte', desc: 'Inscrivez-vous depuis l\'application mobile en quelques minutes.', icon: '📝' },
  { num: '03', title: 'Suivez votre sante', desc: 'Saisissez vos mesures et programmez des teleconsultations.', icon: '📊' },
  { num: '04', title: 'Consultez a distance', desc: 'Appel video securise avec votre cardiologue ou generaliste.', icon: '🩺' },
];

const stats = [
  { value: '24/7', label: 'Disponibilite', sub: 'Urgences cardiaques' },
  { value: '< 30s', label: 'Temps de reponse', sub: 'Alertes critiques' },
  { value: '100%', label: 'Chiffrement', sub: 'Bout en bout' },
  { value: '3', label: 'Applications', sub: 'Patient, Medecin, Admin' },
];

const profiles = [
  {
    role: 'patient',
    title: 'Pour les Patients',
    subtitle: 'Votre sante cardiaque, a portee de main',
    points: [
      'Espace sante personnalise avec historique complet',
      'Saisie des constantes vitales et ECG en direct',
      'Teleconsultation video depuis votre domicile',
      'Bouton d\'urgence cardiaque 24/7',
      'Ordonnances PDF et historique de prescriptions',
      'Profil medical partage avec vos medecins',
    ],
    gradient: 'from-violet-600 to-purple-600',
    btnClass: 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500',
    shadowClass: 'shadow-violet-500/20',
  },
  {
    role: 'medecin',
    title: 'Pour les Medecins',
    subtitle: 'La telecardiologie intelligente au service de vos patients',
    points: [
      'Tableau de bord centralise avec alertes en temps reel',
      'Dossiers medicaux complets avec historique tensionnel',
      'Teleconsultation video HD chiffree',
      'Systeme d\'urgence avec score de risque IA',
      'Ordonnances numeriques et generation PDF',
      'Portefeuille medecin transparent et retrait Mobile Money',
    ],
    gradient: 'from-cyan-600 to-teal-600',
    btnClass: 'bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500',
    shadowClass: 'shadow-cyan-500/20',
  },
];

/* ───── COMPONENT ───── */

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      const userStr = localStorage.getItem('user');
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr);
          if (user.role === 'ADMIN') router.replace('/admin/dashboard');
          else if (user.role === 'MEDECIN' || user.role === 'CARDIOLOGUE') router.replace('/doctor/dashboard');
          else router.replace('/dashboard');
        } catch {}
      }
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-cardio-900 overflow-x-hidden">

      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Modern animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-cardio-950 via-cardio-900 to-cardio-950" />

        {/* Animated gradient orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/4 -left-1/4 w-[600px] h-[600px] rounded-full bg-cyan-500/8 blur-[120px] animate-float-slow" />
          <div className="absolute -bottom-1/4 -right-1/4 w-[500px] h-[500px] rounded-full bg-teal-500/8 blur-[100px] animate-float-slow-reverse" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-cyan-600/5 blur-[80px] animate-pulse-slow" />
        </div>

        {/* Decorative grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(6,182,212,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.3) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* ECG heartbeat line decoration */}
        <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 opacity-[0.06] pointer-events-none">
          <svg viewBox="0 0 1200 120" className="w-full h-24 sm:h-32" preserveAspectRatio="none">
            <path d="M0,60 L200,60 L220,60 L240,20 L260,100 L280,40 L300,80 L320,60 L500,60 L520,60 L540,15 L560,105 L580,35 L600,85 L620,60 L800,60 L820,60 L840,25 L860,95 L880,45 L900,75 L920,60 L1200,60"
              fill="none" stroke="#06b6d4" strokeWidth="2" className="animate-ecg-draw" />
          </svg>
        </div>

        {/* Floating particles */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[15%] left-[10%] w-1.5 h-1.5 rounded-full bg-cyan-400/20 animate-float-particle" />
          <div className="absolute top-[25%] right-[15%] w-1 h-1 rounded-full bg-teal-400/25 animate-float-particle-2" />
          <div className="absolute bottom-[30%] left-[20%] w-2 h-2 rounded-full bg-cyan-400/15 animate-float-particle-3" />
          <div className="absolute top-[60%] right-[25%] w-1.5 h-1.5 rounded-full bg-teal-400/20 animate-float-particle" />
          <div className="absolute top-[40%] left-[70%] w-1 h-1 rounded-full bg-cyan-300/20 animate-float-particle-2" />
          <div className="absolute bottom-[20%] right-[10%] w-1.5 h-1.5 rounded-full bg-cyan-400/15 animate-float-particle-3" />
        </div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-cardio-900 to-transparent" />

        <div className="relative z-10 text-center max-w-4xl px-5 py-16 sm:py-20">
          {/* Logo with glow ring */}
          <div className="mb-8 relative inline-block">
            <div className="absolute inset-0 w-28 h-28 sm:w-32 sm:h-32 mx-auto rounded-full bg-cyan-500/10 blur-xl animate-pulse-slow" />
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 mx-auto rounded-full bg-cardio-800/80 border border-cyan-500/20 flex items-center justify-center backdrop-blur-sm shadow-2xl shadow-cyan-500/10">
              <Image src="/logo-T-Cardio.png" alt="T-Cardio Pro" width={80} height={80} className="drop-shadow-2xl w-16 h-16 sm:w-20 sm:h-20" />
            </div>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold text-white mb-4 tracking-tight leading-tight">
            T-Cardio <span className="text-gradient-cyan">Pro</span>
          </h1>
          <p className="text-lg sm:text-2xl text-gray-200 mb-3 font-light">
            La plateforme de telecardiologie intelligente
          </p>
          <p className="text-sm sm:text-lg text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed px-2">
            Teleconsultation video securisee, suivi cardiaque en temps reel, urgences par IA
            et gestion complete des patients. Concue pour les cardiologues et leurs patients.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-6 px-4 sm:px-0">
            <Link href="/login" className="glow-btn px-8 sm:px-10 py-3.5 sm:py-4 rounded-xl text-base sm:text-lg hover:scale-105 text-center font-semibold transition-transform">
              Se connecter
            </Link>
            <Link href="/download" className="bg-white/10 hover:bg-white/20 text-white px-8 sm:px-10 py-3.5 sm:py-4 rounded-xl border border-white/20 transition-all font-semibold text-base sm:text-lg backdrop-blur-sm hover:scale-105 text-center inline-flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Telecharger l&apos;APK
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 justify-center items-center text-sm">
            <Link href="/download" className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Telecharger l&apos;APK Android
            </Link>
            <span className="hidden sm:inline text-white/20">|</span>
            <Link href="/demos" className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Voir les demonstrations
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce">
          <svg className="w-6 h-6 text-cyan-400/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
        </div>
      </section>

      {/* ═══════════════ TRUST BAR ═══════════════ */}
      <section className="bg-cardio-950/50 border-y border-cyan-500/10 py-8 sm:py-10">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
          {stats.map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-2xl sm:text-3xl font-extrabold text-gradient-cyan">{s.value}</div>
              <div className="text-sm font-semibold text-slate-200 mt-1">{s.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════ FONCTIONNALITES ═══════════════ */}
      <section className="py-16 sm:py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-cyan-400 text-sm font-semibold uppercase tracking-widest mb-3">Fonctionnalites</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
              Une plateforme <span className="text-gradient-cyan">complete</span>
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              T-Cardio Pro reunit tous les outils necessaires pour un suivi cardiologique moderne,
              de la teleconsultation au systeme d&apos;urgence intelligent.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => {
              const colorMap: Record<string, string> = {
                cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
                red: 'text-red-400 bg-red-500/10 border-red-500/20',
                amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
                violet: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
                emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
              };
              const c = colorMap[f.color] || colorMap.cyan;

              return (
                <div key={i} className="glass-card rounded-2xl p-6 hover:border-cyan-500/30 transition-all group">
                  <div className={`w-12 h-12 rounded-xl ${c} border flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    {f.icon}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════ COMMENT CA MARCHE ═══════════════ */}
      <section className="py-16 sm:py-24 px-4 bg-cardio-950/40">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-cyan-400 text-sm font-semibold uppercase tracking-widest mb-3">Comment ca marche</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
              Commencez en <span className="text-gradient-cyan">4 etapes</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <div key={i} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-10 right-0 w-full h-px bg-gradient-to-r from-cyan-500/30 to-transparent translate-x-1/2" />
                )}
                <div className="glass-card rounded-2xl p-6 text-center relative z-10">
                  <div className="text-4xl mb-3">{s.icon}</div>
                  <div className="text-xs font-bold text-cyan-400 mb-2 tracking-widest">ETAPE {s.num}</div>
                  <h3 className="text-base font-bold text-white mb-2">{s.title}</h3>
                  <p className="text-sm text-slate-400">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ PROFILS PATIENT / MEDECIN ═══════════════ */}
      <section className="py-16 sm:py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-cyan-400 text-sm font-semibold uppercase tracking-widest mb-3">Pour qui ?</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
              Adaptee a <span className="text-gradient-cyan">chaque profil</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {profiles.map((p) => (
              <div key={p.role} className="glass-card rounded-2xl overflow-hidden">
                <div className={`bg-gradient-to-r ${p.gradient} p-6`}>
                  <h3 className="text-2xl font-bold text-white">{p.title}</h3>
                  <p className="text-white/70 mt-1 text-sm">{p.subtitle}</p>
                </div>
                <div className="p-6">
                  <ul className="space-y-3 mb-6">
                    {p.points.map((pt, j) => (
                      <li key={j} className="flex items-start gap-3 text-sm text-slate-300">
                        <svg className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {pt}
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-3">
                    <Link href="/download" className={`flex-1 text-center py-3 rounded-xl text-sm font-semibold text-white transition-all shadow-lg ${p.btnClass} ${p.shadowClass} inline-flex items-center justify-center gap-2`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Telecharger l&apos;APK
                    </Link>
                    <Link href="/demos" className="flex-1 text-center py-3 rounded-xl text-sm font-semibold text-slate-300 glass-card hover:border-cyan-500/30 transition-all">
                      Voir la demo
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ SECURITE ═══════════════ */}
      <section className="py-16 sm:py-24 px-4 bg-cardio-950/40">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-cyan-400 text-sm font-semibold uppercase tracking-widest mb-3">Securite &amp; Conformite</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
              Vos donnees <span className="text-gradient-cyan">protegees</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { icon: '🔒', title: 'Chiffrement E2E', desc: 'Toutes les communications sont chiffrees de bout en bout, y compris les appels video et les messages.' },
              { icon: '🛡️', title: 'Donnees Securisees', desc: 'Hebergement securise avec sauvegardes automatiques et acces restreint aux professionnels autorises.' },
              { icon: '🤖', title: 'IA Responsable', desc: 'Le score de risque IA pour les urgences est transparent. Aucune decision medicale n\'est prise automatiquement.' },
            ].map((item, i) => (
              <div key={i} className="glass-card rounded-2xl p-6 text-center">
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-base font-bold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ CTA FINAL ═══════════════ */}
      <section className="py-20 sm:py-28 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/10 via-transparent to-teal-600/10" />
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <Image src="/logo-T-Cardio.png" alt="T-Cardio Pro" width={70} height={70} className="mx-auto mb-6" />
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            Pret a transformer votre pratique ?
          </h2>
          <p className="text-slate-400 mb-8 max-w-xl mx-auto">
            Rejoignez T-Cardio Pro et offrez a vos patients un suivi cardiologique
            de nouvelle generation, accessible partout.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <Link href="/download" className="glow-btn px-10 py-4 rounded-xl text-lg hover:scale-105 font-semibold inline-flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Telecharger l&apos;APK Android
            </Link>
            <Link href="/login" className="glass-card px-10 py-4 rounded-xl text-lg hover:border-cyan-500/30 transition-all font-semibold text-slate-200 hover:text-white inline-flex items-center justify-center gap-2">
              Se connecter
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer className="border-t border-cyan-500/10 bg-cardio-950/80 py-10 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <Image src="/logo-T-Cardio.png" alt="T-Cardio" width={36} height={36} />
                <span className="text-lg font-bold text-white">T-Cardio <span className="text-gradient-cyan">Pro</span></span>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">
                La plateforme de telecardiologie intelligente pour les professionnels de sante et leurs patients.
              </p>
            </div>
            {/* Links */}
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">Plateforme</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><Link href="/login" className="hover:text-cyan-400 transition">Connexion</Link></li>
                <li><Link href="/download" className="hover:text-cyan-400 transition">Telecharger l&apos;APK</Link></li>
                <li><Link href="/demos" className="hover:text-cyan-400 transition">Demonstrations</Link></li>
              </ul>
            </div>
            {/* Contact */}
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">Contact</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" /></svg>
                  t-cardio.org
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  contact@t-cardio.org
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-cyan-500/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-600">&copy; 2026 T-Cardio Pro. Tous droits reserves.</p>
            <div className="flex gap-4 text-xs text-slate-600">
              <span>Telecardiologie intelligente</span>
              <span>&bull;</span>
              <span>Fait avec ❤️</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
