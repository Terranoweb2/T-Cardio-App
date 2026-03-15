'use client';

import Link from 'next/link';
import { useMySubscription } from '@/hooks/useSubscription';
import { useAuthStore } from '@/stores/authStore';

export default function SubscriptionBanner() {
  const user = useAuthStore((s) => s.user);
  const { data } = useMySubscription();

  if (!user || user.role !== 'PATIENT') return null;
  if (!data) return null;

  const { subscription, isActive } = data;

  const daysLeft = subscription?.endDate
    ? Math.ceil(
        (new Date(subscription.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      )
    : 0;

  if (!isActive && (!subscription || subscription.status !== 'ACTIVE')) {
    return (
      <div className="bg-amber-500/10 border-l-4 border-amber-400 p-2 sm:p-3 mx-2 sm:mx-4 mt-2 rounded-r-lg">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-amber-300 text-xs sm:text-sm font-medium leading-tight">
              Abonnement requis pour les teleconsultations
            </p>
          </div>
          <Link
            href="/abonnement"
            className="glow-btn text-[10px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg whitespace-nowrap shrink-0"
          >
            Souscrire
          </Link>
        </div>
      </div>
    );
  }

  if (isActive && daysLeft > 0 && daysLeft <= 7) {
    return (
      <div className="bg-orange-500/10 border-l-4 border-orange-400 p-2 sm:p-3 mx-2 sm:mx-4 mt-2 rounded-r-lg">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-orange-300 text-xs sm:text-sm font-medium leading-tight">
              Abonnement expire dans {daysLeft} jour{daysLeft > 1 ? 's' : ''}
            </p>
          </div>
          <Link
            href="/abonnement"
            className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg font-medium transition whitespace-nowrap shrink-0"
          >
            Renouveler
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
