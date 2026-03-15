'use client';

import Link from 'next/link';
import { useCreditBalance } from '@/hooks/useCredits';
import { useAuthStore } from '@/stores/authStore';

export default function CreditBalanceBadge() {
  const user = useAuthStore((s) => s.user);
  const { data } = useCreditBalance();

  if (!user || user.role !== 'PATIENT') return null;

  const balance = data?.balance ?? 0;

  return (
    <Link
      href="/credits"
      className="flex items-center gap-1 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-md px-1.5 py-0.5 sm:px-3 sm:py-1.5 sm:rounded-lg sm:gap-1.5 transition"
      title="Mes credits"
    >
      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="text-[11px] sm:text-sm font-semibold text-cyan-300">
        {balance.toLocaleString('fr-FR')}
      </span>
      <span className="text-[9px] sm:text-xs text-cyan-500">XOF</span>
    </Link>
  );
}
