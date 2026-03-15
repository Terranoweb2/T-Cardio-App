'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { ArrowDownToLine, Loader2, CheckCircle, XCircle } from 'lucide-react';

const statusLabels: Record<string, { label: string; color: string; bg: string }> = {
 PENDING: { label: 'En attente', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
 PROCESSING: { label: 'En cours', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
 COMPLETED: { label: 'Termine', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
 FAILED: { label: 'Echoue', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
 REJECTED: { label: 'Rejete', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
};

export default function AdminWithdrawalsPage() {
 const queryClient = useQueryClient();
 const [page, setPage] = useState(1);
 const [filterStatus, setFilterStatus] = useState('');
 const [confirmAction, setConfirmAction] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
 const [rejectReason, setRejectReason] = useState('');
 const [processing, setProcessing] = useState(false);

 const { data, isLoading } = useQuery({
  queryKey: ['admin', 'withdrawals', { page, status: filterStatus }],
  queryFn: async () => {
   const params = new URLSearchParams({ page: String(page), limit: '20' });
   if (filterStatus) params.set('status', filterStatus);
   const { data } = await api.get(`/admin/withdrawals?${params}`);
   return data;
  },
 });

 const handleProcess = async () => {
  if (!confirmAction) return;
  setProcessing(true);
  try {
   await api.patch(`/admin/withdrawals/${confirmAction.id}`, {
    action: confirmAction.action,
    reason: confirmAction.action === 'reject' ? rejectReason : undefined,
   });
   queryClient.invalidateQueries({ queryKey: ['admin', 'withdrawals'] });
   setConfirmAction(null);
   setRejectReason('');
  } catch {
  } finally {
   setProcessing(false);
  }
 };

 return (
  <div>
   <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
    <div>
     <h1 className="text-lg sm:text-2xl font-bold text-gradient-cyan flex items-center gap-2">
      <ArrowDownToLine className="w-6 h-6 text-cyan-400" />
      Demandes de retrait
     </h1>
     <p className="text-sm text-slate-400 mt-1">Gerer les retraits Mobile Money des medecins</p>
    </div>
    <select
     value={filterStatus}
     onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
     className="glass-input rounded-lg px-3 py-2 text-sm w-48"
    >
     <option value="">Tous les statuts</option>
     <option value="PENDING">En attente</option>
     <option value="COMPLETED">Termines</option>
     <option value="REJECTED">Rejetes</option>
    </select>
   </div>

   {isLoading ? (
    <div className="flex justify-center py-20">
     <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
    </div>
   ) : !data?.data?.length ? (
    <div className="glass-card p-12 rounded-xl text-center">
     <ArrowDownToLine className="w-10 h-10 text-slate-600 mx-auto mb-3" />
     <p className="text-slate-500 text-sm">Aucune demande de retrait</p>
    </div>
   ) : (
    <div className="glass-card border border-cyan-500/10 rounded-xl overflow-hidden">
     <div className="overflow-x-auto">
      <table className="w-full text-sm">
       <thead className="bg-cardio-800 border-b">
        <tr>
         <th className="text-left px-4 py-3 font-medium text-slate-400">Date</th>
         <th className="text-left px-4 py-3 font-medium text-slate-400">Medecin</th>
         <th className="text-right px-4 py-3 font-medium text-slate-400">Montant</th>
         <th className="text-left px-4 py-3 font-medium text-slate-400 hidden sm:table-cell">Operateur</th>
         <th className="text-left px-4 py-3 font-medium text-slate-400 hidden sm:table-cell">Telephone</th>
         <th className="text-left px-4 py-3 font-medium text-slate-400">Statut</th>
         <th className="text-center px-4 py-3 font-medium text-slate-400">Actions</th>
        </tr>
       </thead>
       <tbody className="divide-y divide-cyan-500/10">
        {data.data.map((w: any) => {
         const status = statusLabels[w.status] || { label: w.status, color: 'text-slate-400', bg: '' };
         return (
          <tr key={w.id} className="hover:bg-cardio-800/50">
           <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
            {new Date(w.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
           </td>
           <td className="px-4 py-3 text-slate-200 font-medium whitespace-nowrap">
            Dr. {w.doctor?.firstName} {w.doctor?.lastName}
           </td>
           <td className="px-4 py-3 text-right text-red-400 font-semibold whitespace-nowrap">
            {w.amount.toLocaleString('fr-FR')} XOF
           </td>
           <td className="px-4 py-3 text-slate-300 hidden sm:table-cell">{w.mobileMoneyOperator}</td>
           <td className="px-4 py-3 text-slate-300 hidden sm:table-cell">{w.mobileMoneyPhone}</td>
           <td className="px-4 py-3">
            <span className={`text-xs font-medium px-2 py-1 rounded-full border ${status.bg} ${status.color}`}>
             {status.label}
            </span>
            {w.failureReason && (
             <p className="text-xs text-red-400 mt-1">{w.failureReason}</p>
            )}
           </td>
           <td className="px-4 py-3 text-center">
            {w.status === 'PENDING' ? (
             <div className="flex items-center justify-center gap-2">
              <button
               onClick={() => setConfirmAction({ id: w.id, action: 'approve' })}
               className="p-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 transition"
               title="Approuver"
              >
               <CheckCircle className="w-4 h-4" />
              </button>
              <button
               onClick={() => setConfirmAction({ id: w.id, action: 'reject' })}
               className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition"
               title="Rejeter"
              >
               <XCircle className="w-4 h-4" />
              </button>
             </div>
            ) : (
             <span className="text-xs text-slate-500">-</span>
            )}
           </td>
          </tr>
         );
        })}
       </tbody>
      </table>
     </div>

     {data.pagination?.totalPages > 1 && (
      <div className="flex items-center justify-between px-4 py-3 border-t border-cyan-500/10 bg-cardio-800/50">
       <p className="text-xs text-slate-400">Page {data.pagination.page} / {data.pagination.totalPages}</p>
       <div className="flex gap-2">
        <button
         onClick={() => setPage((p) => Math.max(1, p - 1))}
         disabled={page <= 1}
         className="px-3 py-1 border border-cyan-500/20 rounded text-xs text-slate-400 disabled:opacity-40 hover:bg-cardio-800 transition"
        >
         Precedent
        </button>
        <button
         onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
         disabled={page >= data.pagination.totalPages}
         className="px-3 py-1 border border-cyan-500/20 rounded text-xs text-slate-400 disabled:opacity-40 hover:bg-cardio-800 transition"
        >
         Suivant
        </button>
       </div>
      </div>
     )}
    </div>
   )}

   {/* Confirmation modal */}
   {confirmAction && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
     <div className="glass-card rounded-2xl w-full max-w-md">
      <div className="px-6 py-4 border-b border-cyan-500/10">
       <h2 className="text-lg font-semibold text-slate-100">
        {confirmAction.action === 'approve' ? 'Approuver le retrait' : 'Rejeter le retrait'}
       </h2>
       <p className="text-sm text-slate-400 mt-0.5">
        {confirmAction.action === 'approve'
         ? 'Confirmez que le virement Mobile Money a ete effectue.'
         : 'Le solde sera rembourse au medecin.'}
       </p>
      </div>

      <div className="px-6 py-5 space-y-4">
       {confirmAction.action === 'reject' && (
        <div>
         <label className="block text-sm font-medium text-slate-300 mb-1">Raison du rejet</label>
         <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Raison du rejet..."
          rows={3}
          className="w-full glass-input rounded-lg px-3 py-2 text-sm resize-none"
         />
        </div>
       )}
      </div>

      <div className="px-6 py-4 border-t border-cyan-500/10 flex justify-end gap-3">
       <button
        onClick={() => { setConfirmAction(null); setRejectReason(''); }}
        className="text-slate-400 hover:text-slate-300 px-4 py-2 text-sm transition"
       >
        Annuler
       </button>
       <button
        onClick={handleProcess}
        disabled={processing}
        className={`px-6 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
         confirmAction.action === 'approve'
          ? 'bg-green-600 hover:bg-green-700 text-white'
          : 'bg-red-600 hover:bg-red-700 text-white'
        }`}
       >
        {processing ? 'Traitement...' : confirmAction.action === 'approve' ? 'Approuver' : 'Rejeter'}
       </button>
      </div>
     </div>
    </div>
   )}
  </div>
 );
}
