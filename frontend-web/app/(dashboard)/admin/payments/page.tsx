'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/query-client';

const statusColors: Record<string, string> = {
 PENDING: 'bg-amber-500/15 text-amber-400',
 COMPLETED: 'bg-green-500/15 text-green-400',
 FAILED: 'bg-red-500/15 text-red-400',
 REFUNDED: 'bg-purple-500/15 text-purple-400',
};

const typeLabels: Record<string, string> = {
 SUBSCRIPTION: 'Abonnement',
 CREDIT_PURCHASE: 'Credits',
};

export default function AdminPaymentsPage() {
 const queryClient = useQueryClient();
 const [activeTab, setActiveTab] = useState<'all' | 'momo'>('all');
 const [page, setPage] = useState(1);
 const [momoPage, setMomoPage] = useState(1);
 const [statusFilter, setStatusFilter] = useState('');
 const [typeFilter, setTypeFilter] = useState('');
 const [actioningId, setActioningId] = useState<string | null>(null);

 const { data, isLoading } = useQuery({
  queryKey: queryKeys.admin.payments({ page, status: statusFilter, type: typeFilter }),
  queryFn: async () => {
   const params = new URLSearchParams({ page: String(page), limit: '20' });
   if (statusFilter) params.set('status', statusFilter);
   if (typeFilter) params.set('type', typeFilter);
   const { data } = await api.get(`/payments/admin/all?${params}`);
   return data;
  },
 });

 const { data: momoData, isLoading: momoLoading } = useQuery({
  queryKey: ['admin', 'momo-pending', momoPage],
  queryFn: async () => {
   const { data } = await api.get(`/payments/momo/pending?page=${momoPage}&limit=20`);
   return data;
  },
  enabled: activeTab === 'momo',
 });

 const confirmMutation = useMutation({
  mutationFn: async (paymentId: string) => {
   setActioningId(paymentId);
   const { data } = await api.post(`/payments/momo/${paymentId}/confirm`);
   return data;
  },
  onSuccess: () => {
   queryClient.invalidateQueries({ queryKey: ['admin', 'momo-pending'] });
   queryClient.invalidateQueries({ queryKey: queryKeys.admin.payments({}) });
   setActioningId(null);
  },
  onError: () => setActioningId(null),
 });

 const rejectMutation = useMutation({
  mutationFn: async (paymentId: string) => {
   setActioningId(paymentId);
   const { data } = await api.post(`/payments/momo/${paymentId}/reject`);
   return data;
  },
  onSuccess: () => {
   queryClient.invalidateQueries({ queryKey: ['admin', 'momo-pending'] });
   queryClient.invalidateQueries({ queryKey: queryKeys.admin.payments({}) });
   setActioningId(null);
  },
  onError: () => setActioningId(null),
 });

 const momoCount = momoData?.pagination?.total || 0;

 return (
  <div className="max-w-6xl mx-auto px-2 py-4 sm:px-4 sm:py-8">
   <h1 className="text-lg sm:text-2xl font-bold text-slate-100 mb-2">Gestion des Paiements</h1>
   <p className="text-slate-400 mb-6">Vue d&apos;ensemble des paiements et revenus</p>

   {/* Stats */}
   {data?.stats && (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-8">
     <div className="glass-card border border-cyan-500/10 rounded-xl p-3 sm:p-5">
      <p className="text-slate-400 text-sm">Revenus du mois</p>
      <p className="text-xl sm:text-2xl font-bold text-green-400 mt-1">
       {(data.stats.monthlyRevenue || 0).toLocaleString('fr-FR')} XOF
      </p>
     </div>
     <div className="glass-card border border-cyan-500/10 rounded-xl p-3 sm:p-5">
      <p className="text-slate-400 text-sm">Abonnements actifs</p>
      <p className="text-xl sm:text-2xl font-bold text-cyan-400 mt-1">
       {data.stats.activeSubscriptions || 0}
      </p>
     </div>
     <div className="glass-card border border-cyan-500/10 rounded-xl p-3 sm:p-5">
      <p className="text-slate-400 text-sm">Transactions ce mois</p>
      <p className="text-xl sm:text-2xl font-bold text-slate-200 mt-1">
       {data.stats.totalTransactions || 0}
      </p>
     </div>
    </div>
   )}

   {/* Tab switcher */}
   <div className="flex gap-2 mb-4">
    <button
     onClick={() => setActiveTab('all')}
     className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
      activeTab === 'all'
       ? 'bg-cyan-600 text-white'
       : 'glass-card text-slate-400 hover:text-cyan-400'
     }`}
    >
     Tous les paiements
    </button>
    <button
     onClick={() => setActiveTab('momo')}
     className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
      activeTab === 'momo'
       ? 'bg-amber-600 text-white'
       : 'glass-card text-slate-400 hover:text-amber-400'
     }`}
    >
     MoMo en attente
     {momoCount > 0 && (
      <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
       activeTab === 'momo' ? 'bg-white/20' : 'bg-amber-500/20 text-amber-400'
      }`}>
       {momoCount}
      </span>
     )}
    </button>
   </div>

   {/* ── All Payments Tab ── */}
   {activeTab === 'all' && (
    <>
     {/* Filters */}
     <div className="flex flex-wrap gap-2 sm:gap-3 mb-4">
      <select
       value={statusFilter}
       onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
       className="border rounded-lg px-3 py-2 text-sm glass-card"
      >
       <option value="">Tous les statuts</option>
       <option value="PENDING">En attente</option>
       <option value="COMPLETED">Complet</option>
       <option value="FAILED">Echoue</option>
       <option value="REFUNDED">Rembourse</option>
      </select>
      <select
       value={typeFilter}
       onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
       className="border rounded-lg px-3 py-2 text-sm glass-card"
      >
       <option value="">Tous les types</option>
       <option value="SUBSCRIPTION">Abonnement</option>
       <option value="CREDIT_PURCHASE">Credits</option>
      </select>
     </div>

     {/* Table */}
     <div className="glass-card border border-cyan-500/10 rounded-xl overflow-hidden">
      {isLoading ? (
       <div className="p-8 text-center">
        <div className="w-6 h-6 border-2 border-cyan-500/20 border-t-blue-600 rounded-full animate-spin mx-auto" />
       </div>
      ) : !data?.data?.length ? (
       <div className="p-8 text-center text-slate-500 text-sm">
        Aucun paiement
       </div>
      ) : (
       <>
        <table className="w-full text-sm">
         <thead className="bg-cardio-800 border-b">
          <tr>
           <th className="text-left px-4 py-3 font-medium text-slate-400">Date</th>
           <th className="text-left px-4 py-3 font-medium text-slate-400">Patient</th>
           <th className="text-left px-4 py-3 font-medium text-slate-400">Type</th>
           <th className="text-right px-4 py-3 font-medium text-slate-400">Montant</th>
           <th className="text-center px-4 py-3 font-medium text-slate-400">Statut</th>
           <th className="text-left px-4 py-3 font-medium text-slate-400">Description</th>
          </tr>
         </thead>
         <tbody className="divide-y">
          {data.data.map((payment: any) => (
           <tr key={payment.id} className="hover:bg-cardio-800/50">
            <td className="px-4 py-3 text-slate-400">
             {new Date(payment.createdAt).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
             })}
            </td>
            <td className="px-4 py-3 text-slate-200">
             {payment.patient
              ? `${payment.patient.firstName || ''} ${payment.patient.lastName || ''}`.trim() || payment.patient.user?.email
              : '-'}
            </td>
            <td className="px-4 py-3 text-slate-300">
             {typeLabels[payment.type] || payment.type}
             {payment.fedapayPaymentMethod === 'MOMO_LOCAL' && (
              <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400">
               MoMo
              </span>
             )}
            </td>
            <td className="px-4 py-3 text-right font-semibold text-slate-100">
             {payment.amountXof.toLocaleString('fr-FR')} XOF
            </td>
            <td className="px-4 py-3 text-center">
             <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[payment.status] || 'bg-cardio-800 text-slate-400'}`}>
              {payment.status}
             </span>
            </td>
            <td className="px-4 py-3 text-slate-400 text-xs max-w-[200px] truncate">
             {payment.description || '-'}
            </td>
           </tr>
          ))}
         </tbody>
        </table>

        {/* Pagination */}
        {data.pagination?.totalPages > 1 && (
         <div className="flex items-center justify-between px-4 py-3 border-t bg-cardio-800/50">
          <p className="text-xs text-slate-400">
           Page {data.pagination.page} / {data.pagination.totalPages} ({data.pagination.total} total)
          </p>
          <div className="flex gap-2">
           <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1 border rounded text-xs disabled:opacity-40"
           >
            Precedent
           </button>
           <button
            onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
            disabled={page >= data.pagination.totalPages}
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
    </>
   )}

   {/* ── MoMo Pending Tab ── */}
   {activeTab === 'momo' && (
    <div className="glass-card border border-amber-500/20 rounded-xl overflow-hidden">
     <div className="bg-gradient-to-r from-amber-600/10 to-yellow-600/10 px-4 py-3 border-b border-amber-500/10">
      <h2 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
       </svg>
       Paiements MoMo en attente de validation
      </h2>
      <p className="text-xs text-slate-500 mt-0.5">
       Verifiez que le paiement a bien ete recu avant de confirmer
      </p>
     </div>

     {momoLoading ? (
      <div className="p-8 text-center">
       <div className="w-6 h-6 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mx-auto" />
      </div>
     ) : !momoData?.data?.length ? (
      <div className="p-8 text-center">
       <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
        <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
         <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
       </div>
       <p className="text-slate-500 text-sm">Aucun paiement MoMo en attente</p>
      </div>
     ) : (
      <>
       {/* Mobile cards */}
       <div className="divide-y divide-amber-500/10">
        {momoData.data.map((payment: any) => {
         const metadata = payment.metadata || {};
         const ref = metadata.momoReference || '-';
         const declaredAt = metadata.declaredPaidAt;
         const patientName = payment.patient
          ? `${payment.patient.firstName || ''} ${payment.patient.lastName || ''}`.trim() || payment.patient.user?.email
          : '-';

         return (
          <div key={payment.id} className="p-4 hover:bg-cardio-800/30 transition">
           <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
             <p className="font-semibold text-slate-200 text-sm truncate">{patientName}</p>
             <p className="text-xs text-slate-500 mt-0.5">
              {new Date(payment.createdAt).toLocaleString('fr-FR', {
               day: '2-digit', month: 'short', year: 'numeric',
               hour: '2-digit', minute: '2-digit',
              })}
             </p>
            </div>
            <div className="text-right shrink-0">
             <p className="text-lg font-bold text-amber-400">
              {payment.amountXof.toLocaleString('fr-FR')} <span className="text-xs font-normal">XOF</span>
             </p>
             <p className="text-xs text-slate-400">
              {typeLabels[payment.type] || payment.type}
             </p>
            </div>
           </div>

           <div className="bg-cardio-800/50 rounded-lg p-3 mb-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
             <div>
              <span className="text-slate-500">Reference MoMo :</span>
              <p className="font-mono font-bold text-cyan-400">{ref}</p>
             </div>
             <div>
              <span className="text-slate-500">Package :</span>
              <p className="text-slate-300 font-medium">{metadata.packageId || '-'}</p>
             </div>
            </div>
            {declaredAt && (
             <p className="text-xs text-green-400 mt-2 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
               <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Declare paye le {new Date(declaredAt).toLocaleString('fr-FR')}
             </p>
            )}
           </div>

           <p className="text-xs text-slate-400 mb-3">{payment.description || ''}</p>

           <div className="flex gap-2">
            <button
             onClick={() => confirmMutation.mutate(payment.id)}
             disabled={actioningId === payment.id}
             className="flex-1 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
             {actioningId === payment.id && confirmMutation.isPending ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
             ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
               <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
             )}
             Confirmer
            </button>
            <button
             onClick={() => rejectMutation.mutate(payment.id)}
             disabled={actioningId === payment.id}
             className="flex-1 py-2 rounded-lg text-sm font-medium bg-red-600/20 text-red-400 hover:bg-red-600/30 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
             {actioningId === payment.id && rejectMutation.isPending ? (
              <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
             ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
               <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
             )}
             Rejeter
            </button>
           </div>
          </div>
         );
        })}
       </div>

       {/* Pagination */}
       {momoData.pagination?.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t bg-cardio-800/50">
         <p className="text-xs text-slate-400">
          Page {momoData.pagination.page} / {momoData.pagination.totalPages}
         </p>
         <div className="flex gap-2">
          <button
           onClick={() => setMomoPage((p) => Math.max(1, p - 1))}
           disabled={momoPage <= 1}
           className="px-3 py-1 border rounded text-xs disabled:opacity-40"
          >
           Precedent
          </button>
          <button
           onClick={() => setMomoPage((p) => Math.min(momoData.pagination.totalPages, p + 1))}
           disabled={momoPage >= momoData.pagination.totalPages}
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
   )}
  </div>
 );
}
