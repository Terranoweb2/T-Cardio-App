'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuthStore } from '@/stores/authStore';
import { SocketProvider } from '@/contexts/SocketContext';
import NotificationBell from '@/components/layout/NotificationBell';
import EmergencyBanner from '@/components/layout/EmergencyBanner';
import SubscriptionBanner from '@/components/payment/SubscriptionBanner';
import CreditBalanceBadge from '@/components/payment/CreditBalanceBadge';
import TickerBanner from '@/components/ads/TickerBanner';
import PopupAd from '@/components/ads/PopupAd';
import IncomingCallHandler from '@/components/layout/IncomingCallHandler';
import ThemeToggle from '@/components/layout/ThemeToggle';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import api from '@/lib/api';
import { initPush } from '@/lib/push';
import {
  Home, Heart, PlusCircle, BarChart3, Sparkles, CalendarDays, CalendarCheck,
  Video, FileText, CreditCard, Coins, Bell, User, Users,
  Mail, Megaphone, Settings, Banknote, ClipboardList,
  LogOut, Menu, X, MoreHorizontal, MessageCircle, MessageSquare, Pill,
  Smartphone, Siren, TestTube, Trophy, Target,
  type LucideIcon,
} from 'lucide-react';

/* ── Icon mapping ── */
const iconMap: Record<string, LucideIcon> = {
  dashboard: Home,
  measurements: Heart,
  add: PlusCircle,
  analytics: BarChart3,
  ai: Sparkles,
  doctor: CalendarDays,
  teleconsult: Video,
  reports: FileText,
  subscription: CreditCard,
  credits: Coins,
  notifications: Bell,
  profile: User,
  patients: Users,
  communication: Mail,
  ads: Megaphone,
  config: Settings,
  payments: Banknote,
  audit: ClipboardList,
  logout: LogOut,
  menu: Menu,
  close: X,
  more: MoreHorizontal,
  chatbot: MessageCircle,
  messaging: MessageSquare,
  prescriptions: Pill,
  momo: Smartphone,
  urgences: Siren,
  appointment: CalendarCheck,
  medications: Pill,
  examResults: TestTube,
  family: Users,
  devices: Smartphone,
  goals: Trophy,
};

// Map nav href to icon key
function getIconKey(href: string): string {
  if (href.includes('/medications')) return 'medications';
  if (href.includes('/exam-results')) return 'examResults';
  if (href.includes('/family')) return 'family';
  if (href.includes('/devices')) return 'devices';
  if (href.includes('/goals')) return 'goals';
  if (href.includes('/book-appointment')) return 'appointment';
  if (href.includes('/urgences')) return 'urgences';
  if (href.includes('/momo-pay')) return 'momo';
  if (href.includes('/chatbot')) return 'chatbot';
  if (href.includes('/messaging')) return 'messaging';
  if (href.includes('/prescriptions')) return 'prescriptions';
  if (href.includes('/measurements/add')) return 'add';
  if (href.includes('/measurements')) return 'measurements';
  if (href.includes('/analytics')) return 'analytics';
  if (href.includes('/ai-analysis')) return 'ai';
  if (href.includes('/my-doctor')) return 'doctor';
  if (href.includes('/consultation-stats')) return 'analytics';
  if (href.includes('/wallet')) return 'payments';
  if (href.includes('/teleconsult')) return 'teleconsult';
  if (href.includes('/reports')) return 'reports';
  if (href.includes('/abonnement')) return 'subscription';
  if (href.includes('/credits')) return 'credits';
  if (href.includes('/notifications')) return 'notifications';
  if (href.includes('/profile')) return 'profile';
  if (href.includes('/patients')) return 'patients';
  if (href.includes('/agenda')) return 'doctor';
  if (href.includes('/communication')) return 'communication';
  if (href.includes('/publicites')) return 'ads';
  if (href.includes('/ai-config')) return 'config';
  if (href.includes('/withdrawals')) return 'payments';
  if (href.includes('/payments')) return 'payments';
  if (href.includes('/audit')) return 'audit';
  if (href.includes('/users')) return 'patients';
  if (href.includes('/doctors')) return 'teleconsult';
  if (href.includes('/dashboard')) return 'dashboard';
  return 'dashboard';
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, loadFromStorage, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    loadFromStorage();
  }, []);

  // Check onboarding for patients
  useEffect(() => {
    if (user && user.role === 'PATIENT' && (user as any).onboardingCompleted === false) {
      setShowOnboarding(true);
    }
  }, [user]);

  // Register push notifications after auth
  useEffect(() => {
    if (isAuthenticated && user) {
      initPush().catch(() => {});
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!isAuthenticated && typeof window !== 'undefined' && !localStorage.getItem('accessToken')) {
      router.push('/login');
      return;
    }
    if (user && user.emailVerified === false && user.role !== 'ADMIN') {
      router.push('/verify-email');
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const patientNav = [
    { href: '/dashboard', label: 'Tableau de bord' },
    { href: '/measurements', label: 'Mesures' },
    { href: '/measurements/add', label: 'Nouvelle mesure' },
    { href: '/analytics', label: 'Analytique' },
    { href: '/ai-analysis', label: 'Analyse T-Cardio' },
    { href: '/chatbot', label: 'Chatbot Sante' },
    { href: '/my-doctor', label: 'Mon medecin' },
    { href: '/book-appointment', label: 'Rendez-vous' },
    { href: '/messaging', label: 'Messagerie' },
    { href: '/teleconsultations', label: 'Teleconsultation' },
    { href: '/urgences', label: 'Urgences' },
    { href: '/reports', label: 'Rapports' },
    { href: '/prescriptions', label: 'Ordonnances' },
    { href: '/medications', label: 'Medicaments' },
    { href: '/exam-results', label: 'Examens' },
    { href: '/family', label: 'Famille' },
    { href: '/devices', label: 'Appareils' },
    { href: '/goals', label: 'Objectifs' },
    { href: '/abonnement', label: 'Abonnement' },
    { href: '/credits', label: 'Credits' },
    { href: '/momo-pay', label: 'Payer via MoMo' },
    { href: '/notifications', label: 'Notifications' },
    { href: '/profile', label: 'Profil' },
  ];

  const doctorNav = [
    { href: '/doctor/dashboard', label: 'Tableau de bord' },
    { href: '/doctor/patients', label: 'Mes patients' },
    { href: '/messaging', label: 'Messagerie' },
    { href: '/book-appointment', label: 'Rendez-vous' },
    { href: '/doctor/agenda', label: 'Mon agenda' },
    { href: '/doctor/teleconsultations', label: 'Teleconsultations' },
    { href: '/doctor/urgences', label: 'Urgences' },
    { href: '/doctor/consultation-stats', label: 'Mes consultations' },
    { href: '/doctor/wallet', label: 'Mon Portefeuille' },
    { href: '/doctor/reports', label: 'Rapports' },
    { href: '/prescriptions', label: 'Ordonnances' },
    { href: '/notifications', label: 'Notifications' },
    { href: '/profile', label: 'Profil' },
  ];

  const adminNav = [
    { href: '/admin/dashboard', label: 'Tableau de bord' },
    { href: '/admin/users', label: 'Utilisateurs' },
    { href: '/admin/doctors', label: 'Medecins' },
    { href: '/admin/withdrawals', label: 'Retraits' },
    { href: '/admin/communication', label: 'Communication' },
    { href: '/admin/publicites', label: 'Publicites' },
    { href: '/admin/ai-config', label: 'Config Seuils' },
    { href: '/admin/payments', label: 'Paiements' },
    { href: '/admin/audit', label: 'Audit' },
    { href: '/notifications', label: 'Notifications' },
    { href: '/profile', label: 'Profil' },
  ];

  const nav = user?.role === 'ADMIN' ? adminNav
    : (user?.role === 'MEDECIN' || user?.role === 'CARDIOLOGUE') ? doctorNav
    : patientNav;

  const patientBottomNav = [
    { href: '/dashboard', label: 'Accueil' },
    { href: '/measurements/add', label: 'Mesure' },
    { href: '/teleconsultations', label: 'Teleconsult' },
    { href: '/profile', label: 'Profil' },
  ];

  const doctorBottomNav = [
    { href: '/doctor/dashboard', label: 'Accueil' },
    { href: '/doctor/patients', label: 'Patients' },
    { href: '/doctor/teleconsultations', label: 'Teleconsult' },
    { href: '/profile', label: 'Profil' },
  ];

  const adminBottomNav = [
    { href: '/admin/dashboard', label: 'Accueil' },
    { href: '/admin/users', label: 'Utilisateurs' },
    { href: '/admin/doctors', label: 'Medecins' },
    { href: '/admin/payments', label: 'Paiements' },
  ];

  const bottomNav = user?.role === 'ADMIN' ? adminBottomNav
    : (user?.role === 'MEDECIN' || user?.role === 'CARDIOLOGUE') ? doctorBottomNav
    : patientBottomNav;

  const isActive = (href: string) => {
    if (href === '/dashboard' || href === '/doctor/dashboard' || href === '/admin/dashboard') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <SocketProvider>
      <IncomingCallHandler />
      <EmergencyBanner />
      <div className="h-screen flex bg-cardio-900 overflow-hidden">
        {/* Mobile overlay backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 w-72 glass-sidebar flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:w-64
        `}>
          <div className="p-5 flex items-center justify-between border-b border-cyan-500/10">
            <div className="min-w-0 flex items-center gap-2.5">
              <Image src="/logo-T-Cardio.png" alt="T-Cardio Pro" width={40} height={40} className="shrink-0" />
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gradient-cyan truncate leading-tight">T-Cardio Pro</h2>
                <p className="text-xs text-slate-400 truncate">{user?.role || ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden lg:block"><ThemeToggle /></span>
              <span className="hidden lg:block"><CreditBalanceBadge /></span>
              <span className="hidden lg:block"><NotificationBell /></span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-1.5 rounded-lg hover:bg-cardio-700/50 transition"
                aria-label="Fermer le menu"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          </div>
          <nav className="px-3 py-3 space-y-0.5 flex-1 overflow-y-auto dark-scrollbar">
            {nav.map((item: any) => {
              const active = isActive(item.href);
              const iconKey = getIconKey(item.href);
              return (
                <div key={item.href}>
                  {item.section && (
                    <div className="mt-4 mb-2 px-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-500/60">{item.section}</p>
                      <div className="border-t border-cyan-500/10 mt-1" />
                    </div>
                  )}
                  <Link href={item.href}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                      active
                        ? 'bg-cyan-500/10 text-cyan-400 font-medium nav-glow'
                        : 'text-slate-300 hover:bg-cardio-700/50 hover:text-cyan-300'
                    }`}>
                    {(() => { const LIcon = iconMap[iconKey] || Home; return <LIcon className={`w-5 h-5 shrink-0 ${active ? 'text-cyan-400' : 'text-slate-400'}`} />; })()}
                    <span className="truncate">{item.label}</span>
                  </Link>
                </div>
              );
            })}
          </nav>
          <div className="p-3 border-t border-cyan-500/10 space-y-1">
            {user && (
              <div className="flex items-center gap-3 px-4 py-2 mb-1">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-600/30 to-teal-600/30 border border-cyan-500/20 flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-cyan-400">
                    {(user.email || '').slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-slate-300 truncate">{user.email || ''}</p>
                  <p className="text-xs text-slate-500 truncate">{user.role === 'ADMIN' ? 'Administrateur' : user.role === 'CARDIOLOGUE' ? 'Cardiologue' : user.role === 'MEDECIN' ? 'Medecin' : 'Patient'}</p>
                </div>
              </div>
            )}
            <button onClick={logout}
              className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200 flex items-center gap-3">
              <LogOut className="w-5 h-5" />
              Deconnexion
            </button>
          </div>
        </aside>

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0 max-w-full overflow-hidden">
          {/* Mobile top bar */}
          <header className="lg:hidden sticky top-0 z-30 glass-header px-2 pb-1.5 pt-[max(1.5rem,env(safe-area-inset-top))] flex items-center justify-between gap-1 overflow-hidden max-w-full">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1 rounded-lg hover:bg-cardio-700/50 transition shrink-0"
              aria-label="Ouvrir le menu"
            >
              <Menu className="w-5 h-5 text-slate-300" />
            </button>
            <div className="flex items-center gap-1 min-w-0 shrink">
              <Image src="/logo-T-Cardio.png" alt="T-Cardio Pro" width={24} height={24} className="shrink-0" />
              <h1 className="text-sm font-bold text-gradient-cyan truncate">T-Cardio Pro</h1>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <ThemeToggle />
              <CreditBalanceBadge />
              <NotificationBell />
            </div>
          </header>

          <SubscriptionBanner />
          {user?.role !== 'ADMIN' && <TickerBanner />}

          {/* Page content */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-3 md:p-6 lg:p-8 bg-cardio-900 pb-24 lg:pb-8 max-w-full">
            <div key={pathname} className="page-transition">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Mobile bottom navigation bar — hidden when sidebar is open */}
      {!sidebarOpen && <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-[9999] safe-area-bottom"
        style={{
          background: 'rgba(8, 18, 35, 0.98)',
          borderTop: '1px solid rgba(6, 182, 212, 0.25)',
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}>
        <div className="flex items-center justify-around px-1 pt-2 pb-[max(8px,env(safe-area-inset-bottom))]">
          {bottomNav.map((item) => {
            const active = isActive(item.href);
            const iconKey = getIconKey(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl min-w-0 flex-1 transition-all duration-200 ${
                  active
                    ? 'text-cyan-400'
                    : 'text-slate-300 active:text-cyan-300'
                }`}
              >
                {(() => { const LIcon = iconMap[iconKey] || Home; return <LIcon className={`w-6 h-6 ${active ? 'text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.5)]' : ''}`} />; })()}
                <span className={`text-[10px] leading-tight text-center font-medium ${
                  active ? 'font-bold text-cyan-400' : ''
                }`}>{item.label}</span>
                {active && <div className="w-1 h-1 rounded-full bg-cyan-400 mt-0.5" />}
              </Link>
            );
          })}
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl text-slate-300 active:text-cyan-300 transition flex-1"
          >
            <MoreHorizontal className="w-6 h-6" />
            <span className="text-[10px] leading-tight font-medium">Plus</span>
          </button>
        </div>
      </nav>}

      {user?.role !== 'ADMIN' && <PopupAd />}

      {showOnboarding && (
        <OnboardingWizard
          onComplete={() => {
            api.patch('/patients/onboarding/complete').catch(() => {});
            setShowOnboarding(false);
          }}
          onSkip={() => setShowOnboarding(false)}
        />
      )}
    </SocketProvider>
  );
}
