'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

export default function AdminDoctorsPage() {
 const [doctors, setDoctors] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [actionLoading, setActionLoading] = useState<string | null>(null);
 const [feedback, setFeedback] = useState<{ id: string; type: 'success' | 'error'; message: string } | null>(null);

 const fetchPending = () => {
  setLoading(true);
  api.get('/admin/doctors/pending')
   .then((r) => setDoctors(r.data))
   .catch(() => {})
   .finally(() => setLoading(false));
 };

 useEffect(() => { fetchPending(); }, []);

 const handleVerify = async (doctorId: string, approved: boolean) => {
  setActionLoading(doctorId);
  setFeedback(null);
  try {
   await api.post(`/admin/doctors/${doctorId}/verify`, { approved });
   setFeedback({
    id: doctorId,
    type: 'success',
    message: approved ? 'Medecin approuve avec succes' : 'Medecin rejete',
   });
   setTimeout(() => {
    setDoctors((prev) => prev.filter((d) => d.id !== doctorId));
    setFeedback(null);
   }, 1500);
  } catch {
   setFeedback({
    id: doctorId,
    type: 'error',
    message: 'Erreur lors du traitement',
   });
  } finally {
   setActionLoading(null);
  }
 };

 if (loading) {
  return (
   <div className="flex justify-center items-center py-20">
    <p className="text-slate-500">Chargement...</p>
   </div>
  );
 }

 return (
  <div>
   <h1 className="text-lg sm:text-2xl font-bold mb-6">Verification des medecins</h1>

   {doctors.length === 0 ? (
    <div className="glass-card p-12 rounded-xl text-center">
     <p className="text-slate-400">Aucun medecin en attente</p>
    </div>
   ) : (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
     {doctors.map((doc: any) => (
      <div key={doc.id} className="glass-card p-6 rounded-xl">
       <div className="mb-4">
        <h3 className="text-lg font-semibold">
         {doc.firstName} {doc.lastName}
        </h3>
        <p className="text-sm text-slate-400">{doc.email}</p>
       </div>

       <div className="space-y-2 text-sm mb-4">
        {doc.specialization && (
         <p>
          <span className="text-slate-400">Specialisation:</span>{' '}
          <span className="font-medium">{doc.specialization}</span>
         </p>
        )}
        {doc.registeredAt && (
         <p>
          <span className="text-slate-400">Inscription:</span>{' '}
          {new Date(doc.registeredAt).toLocaleDateString('fr-FR')}
         </p>
        )}
        {doc.documents && doc.documents.length > 0 && (
         <div>
          <span className="text-slate-400">Documents:</span>
          <ul className="mt-1 space-y-1">
           {doc.documents.map((d: any, i: number) => (
            <li key={i} className="text-cyan-400 text-xs">
             {d.name || d.filename || `Document ${i + 1}`}
            </li>
           ))}
          </ul>
         </div>
        )}
       </div>

       {feedback && feedback.id === doc.id && (
        <div className={`mb-3 px-3 py-2 rounded text-sm ${
         feedback.type === 'success'
          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
          : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
         {feedback.message}
        </div>
       )}

       <div className="flex gap-3">
        <button
         onClick={() => handleVerify(doc.id, true)}
         disabled={actionLoading === doc.id}
         className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition text-sm font-medium"
        >
         Approuver
        </button>
        <button
         onClick={() => handleVerify(doc.id, false)}
         disabled={actionLoading === doc.id}
         className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 transition text-sm font-medium"
        >
         Rejeter
        </button>
       </div>
      </div>
     ))}
    </div>
   )}
  </div>
 );
}
