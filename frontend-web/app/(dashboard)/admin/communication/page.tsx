'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import ContactDoctorModal from '@/components/admin/ContactDoctorModal';

export default function AdminCommunicationPage() {
 const [doctors, setDoctors] = useState<any[]>([]);
 const [messages, setMessages] = useState<any[]>([]);
 const [msgMeta, setMsgMeta] = useState<any>(null);
 const [msgPage, setMsgPage] = useState(1);
 const [contactModal, setContactModal] = useState<any>(null);
 const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

 const fetchDoctors = () => {
  api.get('/admin/doctors/all').then((r) => setDoctors(r.data)).catch(() => {});
 };

 const fetchMessages = () => {
  api.get(`/admin/messages?page=${msgPage}`)
   .then((r) => { setMessages(r.data.data); setMsgMeta(r.data.meta); })
   .catch(() => {});
 };

 useEffect(() => { fetchDoctors(); }, []);
 useEffect(() => { fetchMessages(); }, [msgPage]);

 const handleSuccess = () => {
  setContactModal(null);
  fetchMessages();
  setFeedback({ type: 'success', msg: 'Message envoye avec succes' });
  setTimeout(() => setFeedback(null), 3000);
 };

 return (
  <div>
   <h1 className="text-2xl font-bold mb-6">Communication</h1>

   {feedback && (
    <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
     feedback.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
    }`}>
     {feedback.msg}
    </div>
   )}

   {/* Doctors list */}
   <div className="glass-card rounded-xl mb-6">
    <div className="px-6 py-4 border-b border-cyan-500/10">
     <h2 className="text-lg font-semibold text-slate-100">Medecins verifies</h2>
     <p className="text-sm text-slate-400">{doctors.length} medecin(s) disponible(s)</p>
    </div>
    <div className="overflow-x-auto">
     <table className="w-full min-w-[700px]">
      <thead className="bg-cardio-800">
       <tr>
        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Nom</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Specialite</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Email</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Statut</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Action</th>
       </tr>
      </thead>
      <tbody className="divide-y divide-cyan-500/10">
       {doctors.map((d) => (
        <tr key={d.id} className="hover:bg-cardio-800/50">
         <td className="px-4 py-3 text-sm font-medium text-slate-100">
          Dr. {d.firstName || ''} {d.lastName || ''}
         </td>
         <td className="px-4 py-3">
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-teal-500/15 text-teal-400">
           {d.specialty || 'General'}
          </span>
         </td>
         <td className="px-4 py-3 text-sm text-slate-400">{d.user?.email || '-'}</td>
         <td className="px-4 py-3">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
           d.user?.status === 'ACTIVE' ? 'bg-green-500/15 text-green-400' : 'bg-cardio-800 text-slate-400'
          }`}>
           {d.user?.status || '-'}
          </span>
         </td>
         <td className="px-4 py-3">
          <button
           onClick={() => setContactModal(d)}
           className="px-3 py-1 rounded-lg text-xs font-medium glow-btn transition"
          >
           Contacter
          </button>
         </td>
        </tr>
       ))}
       {doctors.length === 0 && (
        <tr>
         <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Aucun medecin verifie</td>
        </tr>
       )}
      </tbody>
     </table>
    </div>
   </div>

   {/* Messages history */}
   <div className="glass-card rounded-xl">
    <div className="px-6 py-4 border-b border-cyan-500/10">
     <h2 className="text-lg font-semibold text-slate-100">Historique des messages</h2>
    </div>
    <div className="overflow-x-auto">
     <table className="w-full min-w-[600px]">
      <thead className="bg-cardio-800">
       <tr>
        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Sujet</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Priorite</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Lu</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Date</th>
       </tr>
      </thead>
      <tbody className="divide-y divide-cyan-500/10">
       {messages.map((m) => (
        <tr key={m.id} className="hover:bg-cardio-800/50">
         <td className="px-4 py-3">
          <div className="text-sm font-medium text-slate-100">{m.subject}</div>
          <div className="text-xs text-slate-400 truncate max-w-[300px]">{m.content}</div>
         </td>
         <td className="px-4 py-3">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
           m.priority === 'URGENT' ? 'bg-red-500/15 text-red-400' : 'bg-cardio-800 text-slate-400'
          }`}>
           {m.priority}
          </span>
         </td>
         <td className="px-4 py-3 text-sm">
          {m.isRead ? (
           <span className="text-green-400">Oui</span>
          ) : (
           <span className="text-slate-500">Non</span>
          )}
         </td>
         <td className="px-4 py-3 text-xs text-slate-400">
          {new Date(m.createdAt).toLocaleString('fr-FR')}
         </td>
        </tr>
       ))}
       {messages.length === 0 && (
        <tr>
         <td colSpan={4} className="px-4 py-8 text-center text-slate-500">Aucun message envoye</td>
        </tr>
       )}
      </tbody>
     </table>
    </div>

    {msgMeta && msgMeta.totalPages > 1 && (
     <div className="flex justify-center gap-2 py-4 border-t border-cyan-500/10">
      {Array.from({ length: msgMeta.totalPages }, (_, i) => (
       <button key={i} onClick={() => setMsgPage(i + 1)}
        className={`px-3 py-1 rounded text-sm ${msgPage === i + 1 ? 'glow-btn' : 'glass-card border'}`}>
        {i + 1}
       </button>
      ))}
     </div>
    )}
   </div>

   {contactModal && (
    <ContactDoctorModal
     doctor={contactModal}
     onClose={() => setContactModal(null)}
     onSuccess={handleSuccess}
    />
   )}
  </div>
 );
}
