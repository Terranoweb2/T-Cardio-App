'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import CreditAdjustModal from '@/components/admin/CreditAdjustModal';
import BonusCreditModal from '@/components/admin/BonusCreditModal';
import GrantSubscriptionModal from '@/components/admin/GrantSubscriptionModal';
import ContactDoctorModal from '@/components/admin/ContactDoctorModal';

const ROLES = [
 { label: 'Tous', value: '' },
 { label: 'Patient', value: 'PATIENT' },
 { label: 'Medecin', value: 'MEDECIN' },
 { label: 'Cardiologue', value: 'CARDIOLOGUE' },
 { label: 'Admin', value: 'ADMIN' },
];

export default function AdminUsersPage() {
 const [users, setUsers] = useState<any[]>([]);
 const [meta, setMeta] = useState<any>(null);
 const [page, setPage] = useState(1);
 const [roleFilter, setRoleFilter] = useState('');
 const [search, setSearch] = useState('');
 const [searchDebounced, setSearchDebounced] = useState('');
 const [toggling, setToggling] = useState<string | null>(null);
 const [deleting, setDeleting] = useState<string | null>(null);
 const [confirmDelete, setConfirmDelete] = useState<any>(null);
 const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

 // Modals
 const [creditModal, setCreditModal] = useState<any>(null);
 const [bonusModal, setBonusModal] = useState<any>(null);
 const [subModal, setSubModal] = useState<any>(null);
 const [contactModal, setContactModal] = useState<any>(null);

 // Debounce search
 useEffect(() => {
  const t = setTimeout(() => setSearchDebounced(search), 300);
  return () => clearTimeout(t);
 }, [search]);

 const fetchUsers = useCallback(() => {
  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (roleFilter) params.set('role', roleFilter);
  if (searchDebounced) params.set('search', searchDebounced);
  api.get(`/admin/users?${params.toString()}`)
   .then((r) => { setUsers(r.data.data); setMeta(r.data.meta); })
   .catch(() => {});
 }, [page, roleFilter, searchDebounced]);

 useEffect(() => { fetchUsers(); }, [fetchUsers]);

 const toggleStatus = async (userId: string, currentStatus: string) => {
  setToggling(userId);
  const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
  try {
   await api.patch(`/admin/users/${userId}/status`, { status: newStatus });
   fetchUsers();
   showFeedback('success', `Utilisateur ${newStatus === 'ACTIVE' ? 'active' : 'suspendu'}`);
  } catch {
   showFeedback('error', 'Erreur lors du changement de statut');
  } finally {
   setToggling(null);
  }
 };

 const deleteUser = async (userId: string) => {
  setDeleting(userId);
  try {
   await api.delete(`/admin/users/${userId}`);
   setConfirmDelete(null);
   fetchUsers();
   showFeedback('success', 'Utilisateur supprime avec succes');
  } catch (err: any) {
   const msg = err.response?.data?.message || 'Erreur lors de la suppression';
   showFeedback('error', msg);
  } finally {
   setDeleting(null);
  }
 };

 const showFeedback = (type: 'success' | 'error', msg: string) => {
  setFeedback({ type, msg });
  setTimeout(() => setFeedback(null), 3000);
 };

 const handleModalSuccess = (msg: string) => {
  setCreditModal(null);
  setBonusModal(null);
  setSubModal(null);
  setContactModal(null);
  fetchUsers();
  showFeedback('success', msg);
 };

 const getUserName = (u: any) => {
  if (u.patient && (u.patient.firstName || u.patient.lastName)) {
   return `${u.patient.firstName || ''} ${u.patient.lastName || ''}`.trim();
  }
  if (u.doctor && (u.doctor.firstName || u.doctor.lastName)) {
   return `Dr. ${u.doctor.firstName || ''} ${u.doctor.lastName || ''}`.trim();
  }
  return null;
 };

 const statusBadge = (status: string) => {
  const colors: Record<string, string> = {
   ACTIVE: 'bg-green-500/15 text-green-400',
   SUSPENDED: 'bg-red-500/15 text-red-400',
   PENDING: 'bg-amber-500/15 text-amber-400',
   DELETED: 'bg-cardio-800 text-slate-400',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] || 'bg-cardio-800'}`}>{status}</span>;
 };

 const roleBadge = (role: string) => {
  const colors: Record<string, string> = {
   PATIENT: 'bg-cyan-500/15 text-cyan-400',
   MEDECIN: 'bg-teal-500/15 text-teal-400',
   CARDIOLOGUE: 'bg-indigo-500/15 text-indigo-400',
   ADMIN: 'bg-purple-500/15 text-purple-400',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[role] || 'bg-cardio-800'}`}>{role}</span>;
 };

 return (
  <div>
   <h1 className="text-lg sm:text-2xl font-bold mb-6">Gestion des utilisateurs</h1>

   {/* Feedback */}
   {feedback && (
    <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
     feedback.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
    }`}>
     {feedback.msg}
    </div>
   )}

   {/* Search + Filters */}
   <div className="flex flex-col sm:flex-row gap-3 mb-4">
    <div className="flex-1">
     <input
      type="text"
      value={search}
      onChange={(e) => { setSearch(e.target.value); setPage(1); }}
      placeholder="Rechercher par nom ou email..."
      className="w-full glass-input rounded-lg px-4 py-2 text-sm"
     />
    </div>
    <div className="flex gap-2 flex-wrap">
     {ROLES.map((r) => (
      <button
       key={r.value}
       onClick={() => { setRoleFilter(r.value); setPage(1); }}
       className={`px-4 py-2 rounded-lg text-sm transition ${
        roleFilter === r.value ? 'glow-btn' : 'glass-card border text-slate-400 hover:bg-cardio-800/50'
       }`}
      >
       {r.label}
      </button>
     ))}
    </div>
   </div>

   {/* Table */}
   <div className="glass-card rounded-xl overflow-x-auto">
    <table className="w-full min-w-[900px]">
     <thead className="bg-cardio-800">
      <tr>
       <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Utilisateur</th>
       <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Role</th>
       <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Statut</th>
       <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Credits</th>
       <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Abonnement</th>
       <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Derniere cx.</th>
       <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Actions</th>
      </tr>
     </thead>
     <tbody className="divide-y divide-cyan-500/10">
      {users.map((u) => {
       const name = getUserName(u);
       const balance = u.patient?.creditBalance?.balance;
       const activeSub = u.patient?.subscriptions?.[0];
       return (
        <tr key={u.id} className="hover:bg-cardio-800/50">
         <td className="px-4 py-3">
          <div className="text-sm font-medium text-slate-100">{name || u.email}</div>
          {name && <div className="text-xs text-slate-400">{u.email}</div>}
         </td>
         <td className="px-4 py-3">{roleBadge(u.role)}</td>
         <td className="px-4 py-3">{statusBadge(u.status)}</td>
         <td className="px-4 py-3 text-sm">
          {u.role === 'PATIENT' ? (
           <span className={`font-medium ${(balance ?? 0) > 0 ? 'text-green-400' : 'text-slate-500'}`}>
            {(balance ?? 0).toLocaleString()} XOF
           </span>
          ) : (
           <span className="text-slate-600">-</span>
          )}
         </td>
         <td className="px-4 py-3 text-sm">
          {u.role === 'PATIENT' ? (
           activeSub ? (
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
             activeSub.plan === 'PRO' ? 'bg-indigo-500/15 text-indigo-400' : 'bg-cyan-500/15 text-cyan-400'
            }`}>
             {activeSub.plan}
            </span>
           ) : (
            <span className="text-slate-500 text-xs">Aucun</span>
           )
          ) : (
           <span className="text-slate-600">-</span>
          )}
         </td>
         <td className="px-4 py-3 text-xs text-slate-400">
          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('fr-FR') : '-'}
         </td>
         <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
           {/* Patient actions */}
           {u.role === 'PATIENT' && u.patient && (
            <>
             <button onClick={() => setCreditModal(u)} title="Crediter"
              className="px-2 py-1 rounded text-xs bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/15 transition">
              Crediter
             </button>
             <button onClick={() => setBonusModal(u)} title="Bonus"
              className="px-2 py-1 rounded text-xs bg-green-500/10 text-green-400 hover:bg-green-500/15 transition">
              Bonus
             </button>
             <button onClick={() => setSubModal(u)} title="Abonnement"
              className="px-2 py-1 rounded text-xs bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/15 transition">
              Abo
             </button>
            </>
           )}

           {/* Doctor actions */}
           {(u.role === 'MEDECIN' || u.role === 'CARDIOLOGUE') && u.doctor && (
            <button onClick={() => setContactModal({ ...u.doctor, user: { email: u.email } })} title="Contacter"
             className="px-2 py-1 rounded text-xs bg-teal-500/10 text-teal-400 hover:bg-teal-500/15 transition">
             Contacter
            </button>
           )}

           {/* Toggle status */}
           <button
            onClick={() => toggleStatus(u.id, u.status)}
            disabled={toggling === u.id}
            className={`px-2 py-1 rounded text-xs font-medium transition disabled:opacity-50 ${
             u.status === 'ACTIVE'
              ? 'bg-red-500/10 text-red-400 hover:bg-red-500/15'
              : 'bg-green-500/10 text-green-400 hover:bg-green-500/15'
            }`}
           >
            {u.status === 'ACTIVE' ? 'Suspendre' : 'Activer'}
           </button>

           {/* Delete */}
           {u.role !== 'ADMIN' && (
            <button
             onClick={() => setConfirmDelete(u)}
             className="px-2 py-1 rounded text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 transition font-medium"
            >
             Supprimer
            </button>
           )}
          </div>
         </td>
        </tr>
       );
      })}
      {users.length === 0 && (
       <tr>
        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
         Aucun utilisateur trouve
        </td>
       </tr>
      )}
     </tbody>
    </table>
   </div>

   {/* Pagination */}
   {meta && meta.totalPages > 1 && (
    <div className="flex justify-center gap-2 mt-4">
     {Array.from({ length: meta.totalPages }, (_, i) => (
      <button
       key={i}
       onClick={() => setPage(i + 1)}
       className={`px-3 py-1 rounded text-sm ${
        page === i + 1 ? 'glow-btn' : 'glass-card border'
       }`}
      >
       {i + 1}
      </button>
     ))}
    </div>
   )}

   {/* Modals */}
   {creditModal && (
    <CreditAdjustModal
     user={creditModal}
     onClose={() => setCreditModal(null)}
     onSuccess={() => handleModalSuccess('Credits ajustes avec succes')}
    />
   )}
   {bonusModal && (
    <BonusCreditModal
     user={bonusModal}
     onClose={() => setBonusModal(null)}
     onSuccess={() => handleModalSuccess('Bonus accorde avec succes')}
    />
   )}
   {subModal && (
    <GrantSubscriptionModal
     user={subModal}
     onClose={() => setSubModal(null)}
     onSuccess={() => handleModalSuccess('Abonnement accorde avec succes')}
    />
   )}
   {contactModal && (
    <ContactDoctorModal
     doctor={contactModal}
     onClose={() => setContactModal(null)}
     onSuccess={() => handleModalSuccess('Message envoye avec succes')}
    />
   )}

   {/* Delete Confirmation Modal */}
   {confirmDelete && (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
     <div className="glass-card rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-3 mb-4">
       <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
        <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
       </div>
       <div>
        <h3 className="text-lg font-bold text-slate-100">Supprimer l&apos;utilisateur</h3>
        <p className="text-sm text-slate-400">Cette action est irreversible</p>
       </div>
      </div>

      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-5">
       <p className="text-sm text-red-300">
        Voulez-vous vraiment supprimer <span className="font-semibold text-red-200">{getUserName(confirmDelete) || confirmDelete.email}</span> ({confirmDelete.role}) ?
       </p>
       <p className="text-xs text-red-400 mt-2">
        Toutes les donnees associees (mesures, consultations, ordonnances, credits) seront definitivement supprimees.
       </p>
      </div>

      <div className="flex gap-3">
       <button
        onClick={() => setConfirmDelete(null)}
        className="flex-1 py-2.5 rounded-xl text-sm font-medium glass-card hover:bg-cardio-700/50 transition text-slate-300"
       >
        Annuler
       </button>
       <button
        onClick={() => deleteUser(confirmDelete.id)}
        disabled={deleting === confirmDelete.id}
        className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition disabled:opacity-50"
       >
        {deleting === confirmDelete.id ? 'Suppression...' : 'Confirmer la suppression'}
       </button>
      </div>
     </div>
    </div>
   )}
  </div>
 );
}
