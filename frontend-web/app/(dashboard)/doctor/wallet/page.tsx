'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/query-client';
import Link from 'next/link';
import { Banknote, TrendingUp, Video, Phone, MessageSquare, Loader2, ArrowDownToLine, X, Settings } from 'lucide-react';

const transactionTypeLabels: Record<string, { label: string; color: string }> = {
 EARNING_TELECONSULTATION: { label: 'Teleconsultation', color: 'text-green-400' },
 EARNING_EMERGENCY: { label: 'Urgence', color: 'text-green-400' },
 EARNING_MESSAGING: { label: 'Messagerie', color: 'text-green-400' },
 WITHDRAWAL: { label: 'Retrait', color: 'text-red-400' },
 ADMIN_ADJUSTMENT: { label: 'Ajustement', color: 'text-purple-400' },
};

const withdrawalStatusLabels: Record<string, { label: string; color: string; bg: string }> = {
 PENDING: { label: 'En attente', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
 PROCESSING: { label: 'En cours', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
 COMPLETED: { label: 'Termine', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
 FAILED: { label: 'Echoue', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
 REJECTED: { label: 'Rejete', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
};

export default function DoctorWalletPage() {
 const queryClient = useQueryClient();
 const [txPage, setTxPage] = useState(1);
 const [showWithdrawModal, setShowWithdrawModal] = useState(false);
 const [withdrawAmount, setWithdrawAmount] = useState('');
 const [withdrawPhone, setWithdrawPhone] = useState('');
 const [withdrawOperator, setWithdrawOperator] = useState('MTN');
 const [withdrawing, setWithdrawing] = useState(false);
 const [withdrawError, setWithdrawError] = useState('');
 const [withdrawSuccess, setWithdrawSuccess] = useState('');

 const { data: stats, isLoading: statsLoading } = useQuery({
  queryKey: queryKeys.doctorWallet.stats,
  queryFn: async () => {
   const { data } = await api.get('/doctor-wallet/stats');
   return data;
  },
  staleTime: 60 * 1000,
 });

 const { data: txData, isLoading: txLoading } = useQuery({
  queryKey: queryKeys.doctorWallet.transactions(txPage),
  queryFn: async () => {
   const { data } = await api.get(`/doctor-wallet/transactions?page=${txPage}&limit=20`);
   return data;
  },
  placeholderData: (prev: any) => prev,
 });

 const { data: withdrawalsData } = useQuery({
  queryKey: ['doctor-wallet', 'withdrawals'],
  queryFn: async () => {
   const { data } = await api.get('/doctor-wallet/withdrawals?limit=10');
   return data;
  },
 });

 // Fetch doctor profile for dynamic pricing info
 const { data: doctorProfile } = useQuery({
  queryKey: queryKeys.doctor.profile,
  queryFn: async () => {
   const { data } = await api.get('/doctors/profile');
   return data;
  },
  staleTime: 5 * 60 * 1000,
 });

 const handleWithdraw = async () => {
  const amount = parseInt(withdrawAmount, 10);
  if (!amount || amount < 5000) {
   setWithdrawError('Le montant minimum est de 5 000 XOF');
   return;
  }
  if (!withdrawPhone.trim()) {
   setWithdrawError('Le numero Mobile Money est requis');
   return;
  }
  setWithdrawing(true);
  setWithdrawError('');
  try {
   await api.post('/doctor-wallet/withdraw', {
    amount,
    mobileMoneyPhone: withdrawPhone.trim(),
    mobileMoneyOperator: withdrawOperator,
   });
   setWithdrawSuccess('Demande de retrait envoyee ! Vous serez notifie une fois traite.');
   setShowWithdrawModal(false);
   setWithdrawAmount('');
   queryClient.invalidateQueries({ queryKey: queryKeys.doctorWallet.stats });
   queryClient.invalidateQueries({ queryKey: ['doctor-wallet', 'withdrawals'] });
   queryClient.invalidateQueries({ queryKey: queryKeys.doctorWallet.transactions(txPage) });
   setTimeout(() => setWithdrawSuccess(''), 5000);
  } catch (err: any) {
   setWithdrawError(err.response?.data?.message || 'Erreur lors du retrait');
  } finally {
   setWithdrawing(false);
  }
 };

 if (statsLoading) {
  return (
   <div className="flex items-center justify-center py-20">
    <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
   </div>
  );
 }

 const balance = stats?.balance ?? 0;

 const statCards = [
  { label: "Gains aujourd'hui", value: stats?.todayEarnings ?? 0, icon: TrendingUp, color: 'text-cyan-400' },
  { label: 'Gains cette semaine', value: stats?.weekEarnings ?? 0, icon: TrendingUp, color: 'text-cyan-400' },
  { label: 'Gains ce mois', value: stats?.monthEarnings ?? 0, icon: TrendingUp, color: 'text-cyan-400' },
  { label: 'Consultations', value: stats?.totalConsultations ?? 0, icon: Video, color: 'text-green-400' },
 ];

 return (
  <div className="max-w-5xl mx-auto">
   <div className="mb-6">
    <h1 className="text-xl sm:text-2xl font-bold text-gradient-cyan flex items-center gap-2">
     <Banknote className="w-6 h-6 text-cyan-400" />
     Mon Portefeuille
    </h1>
    <p className="text-sm text-slate-400 mt-1">
     Vos revenus de teleconsultations et urgences payantes
    </p>
   </div>

   {/* Success toast */}
   {withdrawSuccess && (
    <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center justify-between">
     <span>{withdrawSuccess}</span>
     <button onClick={() => setWithdrawSuccess('')}><X className="w-4 h-4" /></button>
    </div>
   )}

   {/* Balance card */}
   <div className="bg-gradient-to-br from-cyan-600 via-teal-600 to-cyan-700 rounded-2xl p-4 sm:p-8 mb-6 text-white">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
     <div>
      <p className="text-cyan-200 text-xs sm:text-sm font-medium mb-1">Solde disponible</p>
      <div className="flex items-baseline gap-2">
       <span className="text-3xl sm:text-5xl font-extrabold">
        {balance.toLocaleString('fr-FR')}
       </span>
       <span className="text-base sm:text-xl text-cyan-200">XOF</span>
      </div>
     </div>
     <button
      onClick={() => {
       setShowWithdrawModal(true);
       setWithdrawError('');
       // Pre-fill phone from last withdrawal
       if (withdrawalsData?.data?.[0]) {
        setWithdrawPhone(withdrawalsData.data[0].mobileMoneyPhone || '');
        setWithdrawOperator(withdrawalsData.data[0].mobileMoneyOperator || 'MTN');
       }
      }}
      disabled={balance < 5000}
      className="flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm px-5 py-3 rounded-xl font-semibold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
     >
      <ArrowDownToLine className="w-4 h-4" />
      Retirer
     </button>
    </div>
    {doctorProfile && (() => {
     const pct = doctorProfile.platformCommissionPct ?? 20;
     const netPct = 100 - pct;
     const consul = doctorProfile.consultationPriceXof ?? 5000;
     const msg = doctorProfile.messagingPriceXof ?? 0;
     const urg = doctorProfile.emergencyPriceXof ?? 1000;
     return (
      <div className="mt-3 sm:mt-4 flex flex-wrap gap-3 sm:gap-6 text-sm text-cyan-200">
       <div>
        <span className="block text-xs">Par teleconsultation</span>
        <span className="font-semibold text-white">{Math.round(consul * netPct / 100).toLocaleString('fr-FR')} XOF ({netPct}%)</span>
       </div>
       {msg > 0 && (
        <div>
         <span className="block text-xs">Par messagerie (24h)</span>
         <span className="font-semibold text-white">{Math.round(msg * netPct / 100).toLocaleString('fr-FR')} XOF ({netPct}%)</span>
        </div>
       )}
       <div>
        <span className="block text-xs">Par urgence</span>
        <span className="font-semibold text-white">{urg === 0 ? 'Gratuit' : `${Math.round(urg * netPct / 100).toLocaleString('fr-FR')} XOF (${netPct}%)`}</span>
       </div>
       <Link href="/doctor/pricing" className="flex items-center gap-1 text-xs text-cyan-100 underline underline-offset-2 hover:text-white self-end">
        <Settings className="w-3 h-3" /> Modifier tarifs
       </Link>
      </div>
     );
    })()}
   </div>

   {/* Stats grid */}
   <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
    {statCards.map((card) => (
     <div key={card.label} className="glass-card p-4 sm:p-6 rounded-xl shadow text-center">
      <card.icon className={`w-5 h-5 ${card.color} mx-auto mb-2`} />
      <p className={`text-2xl sm:text-3xl font-bold ${card.color}`}>
       {typeof card.value === 'number' && card.label.includes('Gains')
        ? card.value.toLocaleString('fr-FR')
        : card.value}
      </p>
      <p className="text-xs sm:text-sm text-slate-400 mt-1">{card.label}</p>
      {card.label.includes('Gains') && (
       <p className="text-[10px] text-slate-500 mt-0.5">XOF</p>
      )}
     </div>
    ))}
   </div>

   {/* Emergencies count */}
   {(stats?.totalEmergencies ?? 0) > 0 && (
    <div className="mb-6 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center gap-2">
     <Phone className="w-4 h-4 text-orange-400 flex-shrink-0" />
     <p className="text-sm text-orange-400">
      {stats.totalEmergencies} urgence{stats.totalEmergencies > 1 ? 's' : ''} payante{stats.totalEmergencies > 1 ? 's' : ''} traitee{stats.totalEmergencies > 1 ? 's' : ''}
     </p>
    </div>
   )}

   {/* Withdrawals section */}
   {withdrawalsData?.data?.length > 0 && (
    <div className="mb-8">
     <h2 className="text-lg font-bold text-slate-100 mb-4">Mes retraits</h2>
     <div className="glass-card border border-cyan-500/10 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
       <table className="w-full text-sm">
        <thead className="bg-cardio-800 border-b">
         <tr>
          <th className="text-left px-4 py-3 font-medium text-slate-400">Date</th>
          <th className="text-left px-4 py-3 font-medium text-slate-400">Montant</th>
          <th className="text-left px-4 py-3 font-medium text-slate-400 hidden sm:table-cell">Operateur</th>
          <th className="text-left px-4 py-3 font-medium text-slate-400 hidden sm:table-cell">Telephone</th>
          <th className="text-left px-4 py-3 font-medium text-slate-400">Statut</th>
         </tr>
        </thead>
        <tbody className="divide-y divide-cyan-500/10">
         {withdrawalsData.data.map((w: any) => {
          const status = withdrawalStatusLabels[w.status] || { label: w.status, color: 'text-slate-400', bg: '' };
          return (
           <tr key={w.id} className="hover:bg-cardio-800/50">
            <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
             {new Date(w.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </td>
            <td className="px-4 py-3 text-red-400 font-semibold whitespace-nowrap">
             -{w.amount.toLocaleString('fr-FR')} XOF
            </td>
            <td className="px-4 py-3 text-slate-300 hidden sm:table-cell">{w.mobileMoneyOperator}</td>
            <td className="px-4 py-3 text-slate-300 hidden sm:table-cell">{w.mobileMoneyPhone}</td>
            <td className="px-4 py-3">
             <span className={`text-xs font-medium px-2 py-1 rounded-full border ${status.bg} ${status.color}`}>
              {status.label}
             </span>
            </td>
           </tr>
          );
         })}
        </tbody>
       </table>
      </div>
     </div>
    </div>
   )}

   {/* Transaction history */}
   <h2 className="text-lg font-bold text-slate-100 mb-4">Historique des transactions</h2>
   <div className="glass-card border border-cyan-500/10 rounded-xl overflow-hidden">
    {txLoading ? (
     <div className="p-8 text-center">
      <Loader2 className="w-6 h-6 text-cyan-400 animate-spin mx-auto" />
     </div>
    ) : !txData?.data?.length ? (
     <div className="p-8 text-center">
      <Banknote className="w-10 h-10 text-slate-600 mx-auto mb-3" />
      <p className="text-slate-500 text-sm">Aucune transaction pour le moment</p>
      <p className="text-slate-600 text-xs mt-1">
       Vos revenus apparaitront ici apres vos teleconsultations
      </p>
     </div>
    ) : (
     <>
      <div className="overflow-x-auto">
       <table className="w-full text-sm">
        <thead className="bg-cardio-800 border-b">
         <tr>
          <th className="text-left px-4 py-3 font-medium text-slate-400">Date</th>
          <th className="text-left px-4 py-3 font-medium text-slate-400">Type</th>
          <th className="text-left px-4 py-3 font-medium text-slate-400 hidden sm:table-cell">Description</th>
          <th className="text-right px-4 py-3 font-medium text-slate-400">Montant</th>
          <th className="text-right px-4 py-3 font-medium text-slate-400">Solde</th>
         </tr>
        </thead>
        <tbody className="divide-y divide-cyan-500/10">
         {txData.data.map((tx: any) => {
          const typeInfo = transactionTypeLabels[tx.type] || {
           label: tx.type,
           color: 'text-slate-400',
          };
          return (
           <tr key={tx.id} className="hover:bg-cardio-800/50">
            <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
             {new Date(tx.createdAt).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
             })}
            </td>
            <td className={`px-4 py-3 font-medium ${typeInfo.color}`}>
             {typeInfo.label}
            </td>
            <td className="px-4 py-3 text-slate-300 hidden sm:table-cell">
             {tx.description || '-'}
            </td>
            <td
             className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${
              tx.amount > 0 ? 'text-green-400' : 'text-red-400'
             }`}
            >
             {tx.amount > 0 ? '+' : ''}
             {tx.amount.toLocaleString('fr-FR')} XOF
            </td>
            <td className="px-4 py-3 text-right text-slate-400 whitespace-nowrap">
             {tx.balanceAfter?.toLocaleString('fr-FR')} XOF
            </td>
           </tr>
          );
         })}
        </tbody>
       </table>
      </div>

      {/* Pagination */}
      {txData.pagination?.totalPages > 1 && (
       <div className="flex items-center justify-between px-4 py-3 border-t border-cyan-500/10 bg-cardio-800/50">
        <p className="text-xs text-slate-400">
         Page {txData.pagination.page} / {txData.pagination.totalPages}
        </p>
        <div className="flex gap-2">
         <button
          onClick={() => setTxPage((p) => Math.max(1, p - 1))}
          disabled={txPage <= 1}
          className="px-3 py-1 border border-cyan-500/20 rounded text-xs text-slate-400 disabled:opacity-40 hover:bg-cardio-800 transition"
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
          className="px-3 py-1 border border-cyan-500/20 rounded text-xs text-slate-400 disabled:opacity-40 hover:bg-cardio-800 transition"
         >
          Suivant
         </button>
        </div>
       </div>
      )}
     </>
    )}
   </div>

   {/* Withdrawal Modal */}
   {showWithdrawModal && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
     <div className="glass-card rounded-2xl w-full max-w-md">
      <div className="px-6 py-4 border-b border-cyan-500/10 flex items-center justify-between">
       <div>
        <h2 className="text-lg font-semibold text-slate-100">Demande de retrait</h2>
        <p className="text-sm text-slate-400 mt-0.5">Minimum 5 000 XOF</p>
       </div>
       <button onClick={() => setShowWithdrawModal(false)} className="text-slate-400 hover:text-slate-300">
        <X className="w-5 h-5" />
       </button>
      </div>

      <div className="px-6 py-5 space-y-4">
       <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Montant (XOF)</label>
        <input
         type="number"
         value={withdrawAmount}
         onChange={(e) => setWithdrawAmount(e.target.value)}
         placeholder="5000"
         min={5000}
         max={balance}
         className="w-full glass-input rounded-lg px-3 py-2 text-sm"
        />
        <p className="text-xs text-slate-500 mt-1">Solde disponible : {balance.toLocaleString('fr-FR')} XOF</p>
       </div>

       <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Operateur</label>
        <select
         value={withdrawOperator}
         onChange={(e) => setWithdrawOperator(e.target.value)}
         className="w-full glass-input rounded-lg px-3 py-2 text-sm"
        >
         <option value="MTN">MTN Mobile Money</option>
         <option value="MOOV">Moov Money</option>
         <option value="TOGOCEL">Togocel (T-Money)</option>
        </select>
       </div>

       <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Numero Mobile Money</label>
        <input
         type="tel"
         value={withdrawPhone}
         onChange={(e) => setWithdrawPhone(e.target.value)}
         placeholder="Ex: 90123456"
         className="w-full glass-input rounded-lg px-3 py-2 text-sm"
        />
       </div>

       {withdrawError && (
        <p className="text-sm text-red-400">{withdrawError}</p>
       )}
      </div>

      <div className="px-6 py-4 border-t border-cyan-500/10 flex justify-end gap-3">
       <button
        onClick={() => setShowWithdrawModal(false)}
        className="text-slate-400 hover:text-slate-300 px-4 py-2 text-sm transition"
       >
        Annuler
       </button>
       <button
        onClick={handleWithdraw}
        disabled={withdrawing}
        className="glow-btn px-6 py-2 rounded-lg disabled:opacity-50 transition text-sm font-medium"
       >
        {withdrawing ? 'Envoi...' : 'Confirmer le retrait'}
       </button>
      </div>
     </div>
    </div>
   )}
  </div>
 );
}
