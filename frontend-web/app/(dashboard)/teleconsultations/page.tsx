'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

export default function TeleconsultationsPage() {
 const [teleconsultations, setTeleconsultations] = useState<any[]>([]);
 const [meta, setMeta] = useState<any>(null);
 const [page, setPage] = useState(1);
 const [showForm, setShowForm] = useState(false);
 const [motif, setMotif] = useState('');
 const [submitting, setSubmitting] = useState(false);
 const [hasDoctor, setHasDoctor] = useState<boolean | null>(null);

 const fetchTeleconsultations = () => {
  api.get(`/teleconsultations/patient?page=${page}&limit=20`)
   .then((r) => {
    const list = r.data.data || r.data || [];
    setTeleconsultations(Array.isArray(list) ? list : []);
    setMeta(r.data.meta || null);
   })
   .catch(() => {});
 };

 useEffect(() => {
  fetchTeleconsultations();
  // Check if patient has an associated doctor
  api.get('/patients/my-doctors')
   .then((r) => setHasDoctor(Array.isArray(r.data) && r.data.length > 0))
   .catch(() => setHasDoctor(false));
 }, [page]);

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

 const handleCreate = async () => {
  if (!motif.trim()) return;
  setSubmitting(true);
  try {
   await api.post('/teleconsultations/request', { motif });
   setMotif('');
   setShowForm(false);
   fetchTeleconsultations();
  } catch {
  } finally {
   setSubmitting(false);
  }
 };

 return (
  <div>
   <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
    <h1 className="text-xl sm:text-2xl font-bold">Teleconsultations</h1>
    <button onClick={() => hasDoctor ? setShowForm(!showForm) : null}
     disabled={hasDoctor === false}
     className={`px-4 py-2 rounded-lg transition text-sm text-center ${hasDoctor === false ? 'bg-cardio-800 text-slate-500 cursor-not-allowed' : 'glow-btn'}`}>
     {showForm ? 'Annuler' : '+ Nouvelle demande'}
    </button>
   </div>

   {hasDoctor === false && (
    <div className="glass-card border border-amber-500/20 rounded-xl p-4 sm:p-5 mb-4 sm:mb-6">
     <div className="flex items-start gap-3">
      <div className="shrink-0 w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center">
       <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
       </svg>
      </div>
      <div>
       <h3 className="font-semibold text-amber-300 text-sm">Aucun medecin associe</h3>
       <p className="text-sm text-slate-400 mt-1 leading-relaxed">
        Pour lancer un appel de teleconsultation, vous devez d&apos;abord etre associe a un medecin.
        Demandez a votre medecin de vous fournir un <span className="text-cyan-400 font-medium">code d&apos;invitation</span>, puis saisissez-le sur votre{' '}
        <Link href="/dashboard" className="text-cyan-400 hover:text-cyan-300 font-medium underline underline-offset-2">tableau de bord</Link>.
       </p>
      </div>
     </div>
    </div>
   )}

   {showForm && (
    <div className="glass-card p-4 sm:p-6 rounded-xl mb-4 sm:mb-6">
     <h2 className="font-semibold mb-3">Nouvelle demande de teleconsultation</h2>
     <div className="space-y-3">
      <div>
       <label className="block text-sm font-medium text-slate-300 mb-1">Motif</label>
       <textarea value={motif} onChange={(e) => setMotif(e.target.value)}
        placeholder="Decrivez le motif de votre demande..."
        className="w-full glass-input rounded-lg px-3 py-2 text-sm"
        rows={3} />
      </div>
      <button onClick={handleCreate} disabled={submitting || !motif.trim()}
       className="w-full sm:w-auto glow-btn px-4 py-2 rounded-lg disabled:opacity-50 transition text-sm">
       {submitting ? 'Envoi en cours...' : 'Envoyer la demande'}
      </button>
     </div>
    </div>
   )}

   <div className="glass-card rounded-xl overflow-hidden">
    {/* Desktop table */}
    <div className="hidden md:block">
     <table className="w-full">
      <thead className="bg-cardio-800">
       <tr>
        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Date</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Medecin</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Motif</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Statut</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Actions</th>
       </tr>
      </thead>
      <tbody className="divide-y divide-cyan-500/10">
       {teleconsultations.length === 0 ? (
        <tr>
         <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
          Aucune teleconsultation
         </td>
        </tr>
       ) : (
        teleconsultations.map((tc: any) => (
         <tr key={tc.id}>
          <td className="px-4 py-3 text-sm">
           {tc.scheduledAt ? new Date(tc.scheduledAt).toLocaleString('fr-FR') : new Date(tc.createdAt).toLocaleDateString('fr-FR')}
          </td>
          <td className="px-4 py-3 text-sm text-slate-400">
           {tc.doctor?.firstName
            ? `Dr. ${tc.doctor.firstName} ${tc.doctor.lastName || ''}`.trim()
            : tc.doctorName || tc.doctor?.email || '-'}
          </td>
          <td className="px-4 py-3 text-sm text-slate-300">{tc.motif || tc.reason || '-'}</td>
          <td className="px-4 py-3">{statusBadge(tc.status)}</td>
          <td className="px-4 py-3">
           <Link
            href={`/teleconsultations/${tc.id}`}
            className="text-cyan-400 hover:text-cyan-300 text-sm font-medium hover:underline transition"
           >
            {tc.status === 'PLANNED' || tc.status === 'ACTIVE' ? 'Rejoindre' : 'Voir'}
           </Link>
          </td>
         </tr>
        ))
       )}
      </tbody>
     </table>
    </div>

    {/* Mobile cards */}
    <div className="md:hidden">
     {teleconsultations.length === 0 ? (
      <div className="px-4 py-8 text-center text-slate-500">
       Aucune teleconsultation
      </div>
     ) : (
      <div className="divide-y divide-cyan-500/10">
       {teleconsultations.map((tc: any) => (
        <Link
         key={tc.id}
         href={`/teleconsultations/${tc.id}`}
         className="block p-4 active:bg-cardio-700/30 transition"
        >
         <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-200 truncate mr-2">
           {tc.motif || tc.reason || 'Sans motif'}
          </span>
          {statusBadge(tc.status)}
         </div>
         <div className="flex items-center justify-between text-xs text-slate-400">
          <span>
           {tc.scheduledAt
            ? new Date(tc.scheduledAt).toLocaleString('fr-FR')
            : new Date(tc.createdAt).toLocaleDateString('fr-FR')}
          </span>
          <span className="text-cyan-400 font-medium">
           {tc.status === 'PLANNED' || tc.status === 'ACTIVE' ? 'Rejoindre' : 'Voir'} &rarr;
          </span>
         </div>
        </Link>
       ))}
      </div>
     )}
    </div>
   </div>

   {meta && meta.totalPages > 1 && (
    <div className="flex justify-center gap-2 mt-4 overflow-x-auto pb-2">
     {Array.from({ length: meta.totalPages }, (_, i) => (
      <button key={i} onClick={() => setPage(i + 1)}
       className={`px-3 py-1 rounded text-sm shrink-0 ${page === i + 1 ? 'glow-btn' : 'glass-card border'}`}>
       {i + 1}
      </button>
     ))}
    </div>
   )}
  </div>
 );
}
