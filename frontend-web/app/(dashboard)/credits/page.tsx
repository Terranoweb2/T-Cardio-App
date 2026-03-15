'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreditBalance, useCreditTransactions } from '@/hooks/useCredits';
import { useCreditPackages } from '@/hooks/usePayments';

const transactionTypeLabels: Record<string, { label: string; color: string }> = {
 PURCHASE: { label: 'Achat', color: 'text-green-400' },
 DEBIT_TELECONSULTATION: { label: 'Teleconsultation', color: 'text-red-400' },
 DEBIT_EMERGENCY: { label: 'Urgence', color: 'text-red-400' },
 REFUND: { label: 'Remboursement', color: 'text-cyan-400' },
 ADMIN_ADJUSTMENT: { label: 'Ajustement', color: 'text-purple-400' },
 BONUS: { label: 'Bonus', color: 'text-green-400' },
};

export default function CreditsPage() {
 const router = useRouter();
 const { data: balanceData, isLoading: balLoading } = useCreditBalance();
 const { data: packages, isLoading: pkgLoading } = useCreditPackages();
 const [txPage, setTxPage] = useState(1);
 const { data: txData, isLoading: txLoading } = useCreditTransactions(txPage);

 const balance = balanceData?.balance ?? 0;

 if (balLoading || pkgLoading) {
  return (
   <div className="flex items-center justify-center min-h-[60vh]">
    <div className="w-8 h-8 border-4 border-cyan-500/20 border-t-blue-600 rounded-full animate-spin" />
   </div>
  );
 }

 return (
  <div className="max-w-5xl mx-auto px-2 py-4 sm:px-4 sm:py-8">
   <h1 className="text-lg sm:text-2xl font-bold text-slate-100 mb-2">Mes Credits</h1>
   <p className="text-slate-400 mb-8">
    Gerez vos credits pour les teleconsultations et appels d'urgence
   </p>

   {/* Balance card */}
   <div className="bg-gradient-to-br from-cyan-600 via-teal-600 to-cyan-700 rounded-2xl p-4 sm:p-8 mb-4 sm:mb-8 text-white">
    <p className="text-cyan-200 text-xs sm:text-sm font-medium mb-1">Solde actuel</p>
    <div className="flex items-baseline gap-2">
     <span className="text-3xl sm:text-5xl font-extrabold">
      {balance.toLocaleString('fr-FR')}
     </span>
     <span className="text-base sm:text-xl text-cyan-200">XOF</span>
    </div>
    <div className="mt-3 sm:mt-4 flex flex-wrap gap-3 sm:gap-6 text-sm text-cyan-200">
     <div>
      <span className="block text-xs">Teleconsultation</span>
      <span className="font-semibold text-white">5 000 XOF</span>
     </div>
     <div>
      <span className="block text-xs">Urgence payante</span>
      <span className="font-semibold text-white">1 000 XOF</span>
     </div>
    </div>
   </div>

   {/* Credit packages */}
   <h2 className="text-lg font-bold text-slate-100 mb-4">Recharger mes credits</h2>
   <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
    {(packages || []).map((pkg: any) => {
     const totalCredits = pkg.credits + pkg.bonus;
     return (
      <div
       key={pkg.id}
       className="glass-card border border-cyan-500/10 rounded-xl p-5 hover:border-cyan-500/20 transition-all cursor-pointer group"
       onClick={() => router.push('/momo-pay')}
      >
       <h3 className="font-bold text-slate-200 group-hover:text-cyan-400 transition">
        {pkg.name}
       </h3>
       <div className="mt-3">
        <span className="text-xl sm:text-2xl font-extrabold text-slate-100">
         {pkg.priceXof.toLocaleString('fr-FR')}
        </span>
        <span className="text-slate-400 text-sm ml-1">XOF</span>
       </div>
       <div className="mt-2 text-sm text-slate-400">
        {pkg.credits.toLocaleString('fr-FR')} credits
        {pkg.bonus > 0 && (
         <span className="text-green-400 font-semibold ml-1">
          +{pkg.bonus.toLocaleString('fr-FR')} bonus
         </span>
        )}
       </div>
       <button className="mt-4 w-full py-2 bg-amber-500/10 text-amber-400 rounded-lg font-medium text-sm hover:bg-amber-500/15 transition group-hover:bg-amber-600 group-hover:text-white flex items-center justify-center gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
         <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
        </svg>
        Payer via MoMo
       </button>
      </div>
     );
    })}
   </div>

   {/* Transaction history */}
   <h2 className="text-lg font-bold text-slate-100 mb-4">Historique des transactions</h2>
   <div className="glass-card border border-cyan-500/10 rounded-xl overflow-hidden">
    {txLoading ? (
     <div className="p-8 text-center">
      <div className="w-6 h-6 border-2 border-cyan-500/20 border-t-blue-600 rounded-full animate-spin mx-auto" />
     </div>
    ) : !txData?.data?.length ? (
     <div className="p-8 text-center text-slate-500 text-sm">
      Aucune transaction pour le moment
     </div>
    ) : (
     <>
      <div className="overflow-x-auto">
      <table className="w-full text-xs sm:text-sm min-w-[500px]">
       <thead className="bg-cardio-800 border-b">
        <tr>
         <th className="text-left px-2 sm:px-4 py-2 sm:py-3 font-medium text-slate-400">Date</th>
         <th className="text-left px-2 sm:px-4 py-2 sm:py-3 font-medium text-slate-400">Type</th>
         <th className="text-left px-2 sm:px-4 py-2 sm:py-3 font-medium text-slate-400 hidden sm:table-cell">Description</th>
         <th className="text-right px-2 sm:px-4 py-2 sm:py-3 font-medium text-slate-400">Montant</th>
         <th className="text-right px-2 sm:px-4 py-2 sm:py-3 font-medium text-slate-400">Solde</th>
        </tr>
       </thead>
       <tbody className="divide-y">
        {txData.data.map((tx: any) => {
         const typeInfo = transactionTypeLabels[tx.type] || {
          label: tx.type,
          color: 'text-slate-400',
         };
         return (
          <tr key={tx.id} className="hover:bg-cardio-800/50">
           <td className="px-2 sm:px-4 py-2 sm:py-3 text-slate-400 whitespace-nowrap">
            {new Date(tx.createdAt).toLocaleDateString('fr-FR', {
             day: '2-digit',
             month: 'short',
            })}
           </td>
           <td className={`px-2 sm:px-4 py-2 sm:py-3 font-medium ${typeInfo.color}`}>
            {typeInfo.label}
           </td>
           <td className="px-2 sm:px-4 py-2 sm:py-3 text-slate-300 hidden sm:table-cell">
            {tx.description || '-'}
           </td>
           <td
            className={`px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold whitespace-nowrap ${
             tx.amount > 0 ? 'text-green-400' : 'text-red-400'
            }`}
           >
            {tx.amount > 0 ? '+' : ''}
            {tx.amount.toLocaleString('fr-FR')}
           </td>
           <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-slate-400 whitespace-nowrap">
            {tx.balanceAfter?.toLocaleString('fr-FR')}
           </td>
          </tr>
         );
        })}
       </tbody>
      </table>
      </div>

      {/* Pagination */}
      {txData.pagination?.totalPages > 1 && (
       <div className="flex items-center justify-between px-4 py-3 border-t bg-cardio-800/50">
        <p className="text-xs text-slate-400">
         Page {txData.pagination.page} / {txData.pagination.totalPages}
        </p>
        <div className="flex gap-2">
         <button
          onClick={() => setTxPage((p) => Math.max(1, p - 1))}
          disabled={txPage <= 1}
          className="px-3 py-1 border rounded text-xs disabled:opacity-40"
         >
          Precedent
         </button>
         <button
          onClick={() =>
           setTxPage((p) =>
            Math.min(txData.pagination.totalPages, p + 1),
           )
          }
          disabled={txPage >= txData.pagination.totalPages}
          className="px-3 py-1 border rounded text-xs disabled:opacity-40"
         >
          Suivant
         </button>
        </div>
       </div>
      )}
     </>
    )}
   </div>
  </div>
 );
}
