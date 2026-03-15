'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import ScheduleForm from '@/components/teleconsultation/ScheduleForm';

type StatusFilter = 'ALL' | 'PLANNED' | 'ACTIVE' | 'ENDED';

export default function DoctorTeleconsultationsPage() {
 const [teleconsultations, setTeleconsultations] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
 const [actionLoading, setActionLoading] = useState<string | null>(null);
 const [showScheduleForm, setShowScheduleForm] = useState(false);

 const fetchTeleconsultations = () => {
  setLoading(true);
  api.get('/teleconsultations/doctor')
   .then((r) => setTeleconsultations(r.data.data || r.data))
   .catch(() => {})
   .finally(() => setLoading(false));
 };

 useEffect(() => {
  fetchTeleconsultations();
 }, []);

 const handleStatusChange = async (id: string, newStatus: string) => {
  setActionLoading(id);
  try {
   await api.patch(`/teleconsultations/${id}/status`, { status: newStatus });
   setTeleconsultations((prev) =>
    prev.map((tc) => (tc.id === id ? { ...tc, status: newStatus } : tc))
   );
  } catch {
  } finally {
   setActionLoading(null);
  }
 };

 const statusBadge = (status: string) => {
  const colors: Record<string, string> = {
   PLANNED: 'bg-cyan-500/15 text-cyan-400',
   ACTIVE: 'bg-green-500/15 text-green-400',
   ENDED: 'bg-cardio-800 text-slate-400',
   CANCELLED: 'bg-red-500/15 text-red-400',
  };
  const labels: Record<string, string> = {
   PLANNED: 'Planifiee',
   ACTIVE: 'En cours',
   ENDED: 'Terminee',
   CANCELLED: 'Annulee',
  };
  return (
   <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] || 'bg-cardio-800'}`}>
    {labels[status] || status}
   </span>
  );
 };

 const tabs: { key: StatusFilter; label: string }[] = [
  { key: 'ALL', label: 'Toutes' },
  { key: 'PLANNED', label: 'Planifiees' },
  { key: 'ACTIVE', label: 'En cours' },
  { key: 'ENDED', label: 'Terminees' },
 ];

 const filtered = statusFilter === 'ALL'
  ? teleconsultations
  : teleconsultations.filter((tc) => tc.status === statusFilter);

 return (
  <div>
   <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 sm:mb-6">
    <h1 className="text-xl sm:text-2xl font-bold">Teleconsultations</h1>
    <button
     onClick={() => setShowScheduleForm(!showScheduleForm)}
     className="glow-btn px-4 py-2 rounded-lg transition text-sm w-full sm:w-auto"
    >
     {showScheduleForm ? 'Fermer' : '+ Planifier'}
    </button>
   </div>

   {showScheduleForm && (
    <ScheduleForm
     onSuccess={() => {
      setShowScheduleForm(false);
      fetchTeleconsultations();
     }}
     onCancel={() => setShowScheduleForm(false)}
    />
   )}

   <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
    {tabs.map((tab) => (
     <button
      key={tab.key}
      onClick={() => setStatusFilter(tab.key)}
      className={`px-3 sm:px-4 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 transition ${
       statusFilter === tab.key
        ? 'glow-btn'
        : 'glass-card border border-cyan-500/10 text-slate-400 hover:bg-cardio-800/50'
      }`}
     >
      {tab.label}
      {tab.key !== 'ALL' && (
       <span className="ml-1.5 text-xs opacity-70">
        ({teleconsultations.filter((tc) => tc.status === tab.key).length})
       </span>
      )}
     </button>
    ))}
   </div>

   <div className="glass-card rounded-xl overflow-hidden">
    {loading ? (
     <div className="p-12 text-center text-slate-500">Chargement...</div>
    ) : filtered.length === 0 ? (
     <div className="p-12 text-center text-slate-500">Aucune teleconsultation</div>
    ) : (
     <>
      {/* Desktop table */}
      <div className="hidden md:block">
       <table className="w-full">
        <thead className="bg-cardio-800">
         <tr>
          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Patient</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Date</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Motif</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Statut</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Actions</th>
         </tr>
        </thead>
        <tbody className="divide-y divide-cyan-500/10">
         {filtered.map((tc: any) => (
          <tr key={tc.id} className="hover:bg-cardio-800/50">
           <td className="px-4 py-3 text-sm">
            {tc.patientName || tc.patient?.firstName
             ? `${tc.patient?.firstName || ''} ${tc.patient?.lastName || ''}`.trim()
             : tc.patientEmail || tc.patient?.email || '--'}
           </td>
           <td className="px-4 py-3 text-sm text-slate-400">
            {tc.scheduledAt
             ? new Date(tc.scheduledAt).toLocaleString('fr-FR')
             : '--'}
           </td>
           <td className="px-4 py-3 text-sm text-slate-400">
            {tc.motif || tc.reason || '--'}
           </td>
           <td className="px-4 py-3">{statusBadge(tc.status)}</td>
           <td className="px-4 py-3">
            <div className="flex gap-2 items-center">
             {tc.status === 'PLANNED' && (
              <button
               onClick={() => handleStatusChange(tc.id, 'ACTIVE')}
               disabled={actionLoading === tc.id}
               className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 disabled:opacity-50 transition"
              >
               {actionLoading === tc.id ? '...' : 'Demarrer'}
              </button>
             )}
             {tc.status === 'ACTIVE' && (
              <button
               onClick={() => handleStatusChange(tc.id, 'ENDED')}
               disabled={actionLoading === tc.id}
               className="bg-slate-600 text-white px-3 py-1 rounded text-xs hover:bg-slate-500 disabled:opacity-50 transition"
              >
               {actionLoading === tc.id ? '...' : 'Terminer'}
              </button>
             )}
             <Link
              href={`/teleconsultations/${tc.id}`}
              className="text-cyan-400 hover:text-cyan-300 text-xs font-medium hover:underline transition"
             >
              {tc.status === 'PLANNED' || tc.status === 'ACTIVE' ? 'Rejoindre' : 'Voir'}
             </Link>
            </div>
           </td>
          </tr>
         ))}
        </tbody>
       </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-cyan-500/10">
       {filtered.map((tc: any) => (
        <div key={tc.id} className="p-4">
         <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium truncate mr-2">
           {tc.patientName || tc.patient?.firstName
            ? `${tc.patient?.firstName || ''} ${tc.patient?.lastName || ''}`.trim()
            : tc.patientEmail || tc.patient?.email || '--'}
          </span>
          {statusBadge(tc.status)}
         </div>
         <p className="text-xs text-slate-400 mb-2 line-clamp-2">
          {tc.motif || tc.reason || 'Sans motif'}
         </p>
         <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">
           {tc.scheduledAt ? new Date(tc.scheduledAt).toLocaleString('fr-FR') : '--'}
          </span>
          <div className="flex gap-2 items-center">
           {tc.status === 'PLANNED' && (
            <button
             onClick={(e) => { e.preventDefault(); handleStatusChange(tc.id, 'ACTIVE'); }}
             disabled={actionLoading === tc.id}
             className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 disabled:opacity-50 transition"
            >
             {actionLoading === tc.id ? '...' : 'Demarrer'}
            </button>
           )}
           {tc.status === 'ACTIVE' && (
            <button
             onClick={(e) => { e.preventDefault(); handleStatusChange(tc.id, 'ENDED'); }}
             disabled={actionLoading === tc.id}
             className="bg-slate-600 text-white px-3 py-1 rounded text-xs hover:bg-slate-500 disabled:opacity-50 transition"
            >
             {actionLoading === tc.id ? '...' : 'Terminer'}
            </button>
           )}
           <Link
            href={`/teleconsultations/${tc.id}`}
            className="text-cyan-400 text-xs font-medium"
           >
            {tc.status === 'PLANNED' || tc.status === 'ACTIVE' ? 'Rejoindre' : 'Voir'} &rarr;
           </Link>
          </div>
         </div>
        </div>
       ))}
      </div>
     </>
    )}
   </div>
  </div>
 );
}
