'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { getEmergencySocket } from '@/lib/socket';
import { useDoctorInvitations, useGenerateInvitation, useRevokeInvitation } from '@/hooks/useInvitations';

export default function DoctorPatientsPage() {
 const [patients, setPatients] = useState<any[]>([]);
 const [filtered, setFiltered] = useState<any[]>([]);
 const [search, setSearch] = useState('');
 const [loading, setLoading] = useState(true);
 const [showAddPanel, setShowAddPanel] = useState(false);
 const [activeTab, setActiveTab] = useState<'token' | 'email'>('token');
 const [disconnectConfirm, setDisconnectConfirm] = useState<string | null>(null);
 const [disconnectLoading, setDisconnectLoading] = useState(false);

 // Email link (existing)
 const [linkEmail, setLinkEmail] = useState('');
 const [linkLoading, setLinkLoading] = useState(false);
 const [linkMessage, setLinkMessage] = useState('');

 // Token system
 const { data: invitations = [], refetch: refetchInvitations } = useDoctorInvitations();
 const generateMutation = useGenerateInvitation();
 const revokeMutation = useRevokeInvitation();
 const [generatedToken, setGeneratedToken] = useState<string | null>(null);
 const [copied, setCopied] = useState(false);

 const fetchPatients = () => {
  setLoading(true);
  api.get('/doctors/patients')
   .then((r) => {
    const data = r.data.data || r.data;
    setPatients(data);
    setFiltered(data);
   })
   .catch(() => {})
   .finally(() => setLoading(false));
 };

 useEffect(() => {
  fetchPatients();
 }, []);

 // Auto-refresh when any patient updates their profile (real-time WebSocket)
 useEffect(() => {
  const socket = getEmergencySocket();
  const handlePatientUpdated = () => {
   fetchPatients();
  };
  socket.on('patient_updated', handlePatientUpdated);
  return () => {
   socket.off('patient_updated', handlePatientUpdated);
  };
 }, []);

 useEffect(() => {
  if (!search.trim()) {
   setFiltered(patients);
  } else {
   const q = search.toLowerCase();
   setFiltered(
    patients.filter(
     (p) =>
      (p.firstName || '').toLowerCase().includes(q) ||
      (p.lastName || '').toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q)
    )
   );
  }
 }, [search, patients]);

 // Generate token
 const handleGenerateToken = async () => {
  try {
   const result = await generateMutation.mutateAsync(48);
   setGeneratedToken(result.token);
   setCopied(false);
  } catch {
   // Error handled by mutation
  }
 };

 // Copy to clipboard
 const handleCopy = async (text: string) => {
  try {
   await navigator.clipboard.writeText(text);
   setCopied(true);
   setTimeout(() => setCopied(false), 2000);
  } catch {
   // Fallback
   const textarea = document.createElement('textarea');
   textarea.value = text;
   document.body.appendChild(textarea);
   textarea.select();
   document.execCommand('copy');
   document.body.removeChild(textarea);
   setCopied(true);
   setTimeout(() => setCopied(false), 2000);
  }
 };

 // Revoke token
 const handleRevoke = async (tokenId: string) => {
  try {
   await revokeMutation.mutateAsync(tokenId);
  } catch {
   // Error handled
  }
 };

 // Email link (existing)
 const handleLink = async () => {
  if (!linkEmail.trim()) return;
  setLinkLoading(true);
  setLinkMessage('');
  try {
   await api.post('/doctors/patients/link', { patientEmail: linkEmail.trim() });
   setLinkMessage('Patient associe avec succes');
   setLinkEmail('');
   fetchPatients();
  } catch (err: any) {
   setLinkMessage(err.response?.data?.message || 'Erreur lors de l\'association');
  } finally {
   setLinkLoading(false);
  }
 };

 // Display name with email fallback when names are empty
 const patientName = (p: any) => {
  const first = (p.firstName || '').trim();
  const last = (p.lastName || '').trim();
  if (first || last) return `${first} ${last}`.trim();
  if (p.email) return p.email;
  return 'Patient sans nom';
 };

 const riskBadge = (level: string) => {
  const colors: Record<string, string> = {
   FAIBLE: 'bg-green-500/15 text-green-400',
   MODERE: 'bg-amber-500/15 text-amber-400',
   ELEVE: 'bg-red-500/15 text-red-400',
   CRITIQUE: 'bg-red-500/20 text-red-300',
  };
  return (
   <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[level] || 'bg-cardio-800'}`}>
    {level}
   </span>
  );
 };

 // Confidential disconnect
 const handleDisconnect = async (patientId: string) => {
  setDisconnectLoading(true);
  try {
   await api.patch(`/doctors/patients/${patientId}/disconnect`, {});
   setDisconnectConfirm(null);
   fetchPatients();
  } catch {
   alert('Erreur lors de la deconnexion');
  } finally {
   setDisconnectLoading(false);
  }
 };

 const getTokenStatus = (inv: any) => {
  if (inv.isUsed) return { label: 'Utilise', color: 'bg-green-500/15 text-green-400' };
  if (inv.isExpired) return { label: 'Expire', color: 'bg-cardio-800 text-slate-400' };
  return { label: 'En attente', color: 'bg-amber-500/15 text-amber-400' };
 };

 return (
  <div>
   <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
    <h1 className="text-xl sm:text-2xl font-bold">Mes patients</h1>
    <button
     onClick={() => setShowAddPanel(!showAddPanel)}
     className="glow-btn px-4 py-2 rounded-lg transition text-sm w-full sm:w-auto"
    >
     {showAddPanel ? 'Fermer' : '+ Ajouter un patient'}
    </button>
   </div>

   {/* ==================== ADD PATIENT PANEL ==================== */}
   {showAddPanel && (
    <div className="glass-card rounded-xl mb-6 overflow-hidden">
     {/* Tabs */}
     <div className="flex border-b">
      <button
       onClick={() => setActiveTab('token')}
       className={`flex-1 px-4 py-3 text-sm font-medium transition ${
        activeTab === 'token'
         ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/10'
         : 'text-slate-400 hover:text-slate-300'
       }`}
      >
       Invitation par code
      </button>
      <button
       onClick={() => setActiveTab('email')}
       className={`flex-1 px-4 py-3 text-sm font-medium transition ${
        activeTab === 'email'
         ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/10'
         : 'text-slate-400 hover:text-slate-300'
       }`}
      >
       Association par email
      </button>
     </div>

     <div className="p-6">
      {/* TOKEN TAB */}
      {activeTab === 'token' && (
       <div>
        <p className="text-sm text-slate-400 mb-4">
         Generez un code d&apos;invitation et communiquez-le a votre patient. Il pourra l&apos;utiliser pour se connecter a votre suivi.
        </p>

        {/* Generate button */}
        <button
         onClick={handleGenerateToken}
         disabled={generateMutation.isPending}
         className="glow-btn px-6 py-2.5 rounded-lg disabled:opacity-50 transition text-sm font-medium mb-4"
        >
         {generateMutation.isPending ? 'Generation...' : 'Generer un code d\'invitation'}
        </button>

        {/* Generated token display */}
        {generatedToken && (
         <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-5 mb-5">
          <p className="text-sm text-cyan-400 font-medium mb-2">Code d&apos;invitation genere :</p>
          <div className="flex items-center gap-3 flex-wrap">
           <span className="text-3xl sm:text-4xl font-mono font-bold text-cyan-300 tracking-wider">
            {generatedToken}
           </span>
           <button
            onClick={() => handleCopy(generatedToken)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
             copied
              ? 'bg-green-500/15 text-green-400'
              : 'glass-card border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/15'
            }`}
           >
            {copied ? 'Copie !' : 'Copier'}
           </button>
          </div>
          <p className="text-xs text-cyan-400 mt-2">
           Valide pendant 48 heures. Communiquez ce code a votre patient.
          </p>
         </div>
        )}

        {/* Invitation history */}
        {invitations.length > 0 && (
         <div>
          <h4 className="font-medium text-sm text-slate-300 mb-3">Historique des invitations</h4>
          <div className="space-y-2">
           {invitations.map((inv: any) => {
            const status = getTokenStatus(inv);
            return (
             <div
              key={inv.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-cardio-800/50 rounded-lg"
             >
              <div className="flex items-center gap-3 flex-wrap">
               <span className="font-mono font-semibold text-sm">{inv.token}</span>
               <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.color}`}>
                {status.label}
               </span>
               {inv.usedBy && (
                <span className="text-xs text-slate-400">
                 par {inv.usedBy.firstName} {inv.usedBy.lastName}
                </span>
               )}
              </div>
              <div className="flex items-center gap-3">
               <span className="text-xs text-slate-500">
                {new Date(inv.createdAt).toLocaleDateString('fr-FR', {
                 day: '2-digit',
                 month: '2-digit',
                 year: 'numeric',
                 hour: '2-digit',
                 minute: '2-digit',
                })}
               </span>
               {!inv.isUsed && !inv.isExpired && (
                <button
                 onClick={() => handleRevoke(inv.id)}
                 disabled={revokeMutation.isPending}
                 className="text-red-500 hover:text-red-300 text-xs font-medium disabled:opacity-50"
                >
                 Revoquer
                </button>
               )}
              </div>
             </div>
            );
           })}
          </div>
         </div>
        )}
       </div>
      )}

      {/* EMAIL TAB */}
      {activeTab === 'email' && (
       <div>
        <h3 className="font-semibold mb-3">Associer un patient par email</h3>
        <div className="flex flex-col sm:flex-row gap-3">
         <input
          type="email"
          value={linkEmail}
          onChange={(e) => setLinkEmail(e.target.value)}
          placeholder="Email du patient"
          className="flex-1 glass-input rounded-lg px-4 py-2 text-sm"
         />
         <button
          onClick={handleLink}
          disabled={linkLoading}
          className="glow-btn px-6 py-2 rounded-lg disabled:opacity-50 transition text-sm"
         >
          {linkLoading ? 'Association...' : 'Associer'}
         </button>
        </div>
        {linkMessage && (
         <p className={`text-sm mt-2 ${linkMessage.includes('succes') ? 'text-green-400' : 'text-red-400'}`}>
          {linkMessage}
         </p>
        )}
       </div>
      )}
     </div>
    </div>
   )}

   {/* ==================== SEARCH ==================== */}
   <div className="mb-4">
    <input
     type="text"
     value={search}
     onChange={(e) => setSearch(e.target.value)}
     placeholder="Rechercher un patient (nom, email)..."
     className="w-full md:w-96 glass-input rounded-lg px-4 py-2 text-sm"
    />
   </div>

   {/* ==================== PATIENTS LIST ==================== */}
   <div className="glass-card rounded-xl overflow-hidden">
    {loading ? (
     <div className="p-12 text-center text-slate-500">Chargement...</div>
    ) : filtered.length === 0 ? (
     <div className="p-12 text-center text-slate-500">
      {search ? 'Aucun patient trouve' : 'Aucun patient associe'}
     </div>
    ) : (
     <>
      {/* Desktop table */}
      <table className="w-full hidden md:table">
       <thead className="bg-cardio-800">
        <tr>
         <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Nom</th>
         <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Email</th>
         <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Statut medical</th>
         <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Derniere mesure</th>
         <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Risque</th>
         <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Action</th>
        </tr>
       </thead>
       <tbody className="divide-y divide-cyan-500/10">
        {filtered.map((p: any) => (
         <tr key={p.id} className={p.lastRiskLevel === 'CRITIQUE' ? 'bg-red-500/10' : 'hover:bg-cardio-800/50'}>
          <td className="px-4 py-3 text-sm font-medium">
           {patientName(p)}
          </td>
          <td className="px-4 py-3 text-sm text-slate-400">{p.email}</td>
          <td className="px-4 py-3 text-sm text-slate-400">{p.medicalStatus || '--'}</td>
          <td className="px-4 py-3 text-sm font-medium">
           {p.lastSystolic && p.lastDiastolic
            ? `${p.lastSystolic}/${p.lastDiastolic} mmHg`
            : '--/--'}
          </td>
          <td className="px-4 py-3">
           {p.lastRiskLevel ? riskBadge(p.lastRiskLevel) : (
            <span className="text-xs text-slate-500">N/A</span>
           )}
          </td>
          <td className="px-4 py-3">
           <div className="flex items-center gap-2">
            <Link
             href={`/doctor/patients/${p.id}`}
             className="text-cyan-400 hover:text-cyan-300 text-sm font-medium"
            >
             Voir
            </Link>
            {disconnectConfirm === p.id ? (
             <div className="flex items-center gap-1">
              <button
               onClick={() => handleDisconnect(p.id)}
               disabled={disconnectLoading}
               className="text-red-400 hover:text-red-300 text-xs font-medium disabled:opacity-50"
              >
               {disconnectLoading ? '...' : 'Confirmer'}
              </button>
              <button
               onClick={() => setDisconnectConfirm(null)}
               className="text-slate-500 hover:text-slate-400 text-xs"
              >
               Annuler
              </button>
             </div>
            ) : (
             <button
              onClick={() => setDisconnectConfirm(p.id)}
              className="text-slate-500 hover:text-red-500 transition"
              title="Deconnecter ce patient (confidentiel)"
             >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
               <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
             </button>
            )}
           </div>
          </td>
         </tr>
        ))}
       </tbody>
      </table>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-cyan-500/10">
       {filtered.map((p: any) => (
        <Link
         key={p.id}
         href={`/doctor/patients/${p.id}`}
         className={`block p-4 hover:bg-cardio-800/50 ${p.lastRiskLevel === 'CRITIQUE' ? 'bg-red-500/10' : ''}`}
        >
         <div className="flex justify-between items-start mb-1">
          <span className="font-medium text-sm">{patientName(p)}</span>
          {p.lastRiskLevel ? riskBadge(p.lastRiskLevel) : null}
         </div>
         <div className="text-xs text-slate-400 mb-1">{p.email}</div>
         <div className="flex justify-between items-center">
          <span className="text-sm font-medium">
           {p.lastSystolic && p.lastDiastolic
            ? `${p.lastSystolic}/${p.lastDiastolic} mmHg`
            : '--/--'}
          </span>
          <span className="text-cyan-400 text-xs font-medium">Voir &rarr;</span>
         </div>
        </Link>
       ))}
      </div>
     </>
    )}
   </div>
  </div>
 );
}
