'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

export default function DoctorReportsPage() {
 const [reports, setReports] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [filter, setFilter] = useState<'all' | 'signed' | 'unsigned'>('all');
 const [searchQuery, setSearchQuery] = useState('');

 const [showGenerate, setShowGenerate] = useState(false);
 const [genPatientId, setGenPatientId] = useState('');
 const [genPeriodMode, setGenPeriodMode] = useState<'preset' | 'custom'>('preset');
 const [genPeriodDays, setGenPeriodDays] = useState(30);
 const [genDateStart, setGenDateStart] = useState('');
 const [genDateEnd, setGenDateEnd] = useState('');
 const [genReportType, setGenReportType] = useState('MENSUEL');
 const [genDoctorNotes, setGenDoctorNotes] = useState('');
 const [genLoading, setGenLoading] = useState(false);
 const [genMessage, setGenMessage] = useState('');

 const [patients, setPatients] = useState<any[]>([]);
 const [signingId, setSigningId] = useState<string | null>(null);

 useEffect(() => {
  api.get('/reports/doctor')
   .then((r) => setReports(r.data.data || r.data))
   .catch(() => {})
   .finally(() => setLoading(false));

  api.get('/doctors/patients')
   .then((r) => setPatients(r.data.data || r.data))
   .catch(() => {});
 }, []);

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

 const reportTypeBadge = (type: string) => {
  const colors: Record<string, string> = {
   HEBDOMADAIRE: 'bg-purple-500/15 text-purple-400',
   MENSUEL: 'bg-cyan-500/15 text-cyan-400',
   TRIMESTRIEL: 'bg-indigo-500/15 text-indigo-400',
   PERSONNALISE: 'bg-cardio-800 text-slate-300',
   URGENCE: 'bg-red-500/15 text-red-400',
  };
  return (
   <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[type] || 'bg-cardio-800'}`}>
    {type}
   </span>
  );
 };

 const handleDownload = async (reportId: string) => {
  try {
   const response = await api.get(`/reports/${reportId}/download`, {
    responseType: 'blob',
   });
   const url = window.URL.createObjectURL(new Blob([response.data]));
   const link = document.createElement('a');
   link.href = url;
   link.setAttribute('download', `rapport-${reportId}.pdf`);
   document.body.appendChild(link);
   link.click();
   link.remove();
   window.URL.revokeObjectURL(url);
  } catch {
  }
 };

 const handleGenerate = async () => {
  if (!genPatientId) return;
  setGenLoading(true);
  setGenMessage('');
  try {
   // Calculate periodStart/periodEnd from periodDays or custom dates
   let periodStart: string;
   let periodEnd: string;

   if (genPeriodMode === 'custom' && genDateStart && genDateEnd) {
    periodStart = new Date(genDateStart).toISOString();
    periodEnd = new Date(genDateEnd).toISOString();
   } else {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - genPeriodDays);
    periodStart = start.toISOString();
    periodEnd = end.toISOString();
   }

   const { data } = await api.post('/reports/generate', {
    patientId: genPatientId,
    periodStart,
    periodEnd,
    reportType: genReportType,
    doctorNotes: genDoctorNotes.trim() || undefined,
   });
   setReports((prev) => [data, ...prev]);
   setGenMessage('Rapport genere avec succes');
   setShowGenerate(false);
   setGenPatientId('');
   setGenDoctorNotes('');
  } catch (err: any) {
   setGenMessage(err.response?.data?.message || 'Erreur lors de la generation');
  } finally {
   setGenLoading(false);
  }
 };

 const handleSign = async (reportId: string) => {
  setSigningId(reportId);
  try {
   await api.patch(`/reports/${reportId}/sign`);
   setReports((prev) =>
    prev.map((r) =>
     r.id === reportId ? { ...r, signedAt: new Date().toISOString(), signedBy: 'current' } : r,
    ),
   );
  } catch (err: any) {
   alert(err.response?.data?.message || 'Erreur lors de la signature');
  } finally {
   setSigningId(null);
  }
 };

 // Filter and search reports
 const filteredReports = reports.filter((r) => {
  if (filter === 'signed' && !r.signedAt) return false;
  if (filter === 'unsigned' && r.signedAt) return false;
  if (searchQuery) {
   const name = r.patientName || `${r.patient?.firstName || ''} ${r.patient?.lastName || ''}`.trim();
   if (!name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
  }
  return true;
 });

 const formatPeriod = (r: any) => {
  if (r.periodStart && r.periodEnd) {
   return `${new Date(r.periodStart).toLocaleDateString('fr-FR')} - ${new Date(r.periodEnd).toLocaleDateString('fr-FR')}`;
  }
  if (r.periodDays) return `${r.periodDays} jours`;
  return '--';
 };

 return (
  <div>
   <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
    <h1 className="text-xl sm:text-2xl font-bold">Rapports</h1>
    <button
     onClick={() => setShowGenerate(!showGenerate)}
     className="glow-btn px-4 py-2 rounded-lg transition text-sm text-center"
    >
     {showGenerate ? 'Annuler' : '+ Generer un rapport'}
    </button>
   </div>

   {genMessage && (
    <div className={`mb-4 p-3 rounded-lg text-sm ${
     genMessage.includes('succes') ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
    }`}>
     {genMessage}
    </div>
   )}

   {showGenerate && (
    <div className="glass-card p-4 sm:p-6 rounded-xl mb-4 sm:mb-6">
     <h3 className="font-semibold mb-4">Generer un nouveau rapport</h3>
     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Patient select */}
      <div>
       <label className="block text-sm font-medium text-slate-300 mb-1">Patient *</label>
       <select
        value={genPatientId}
        onChange={(e) => setGenPatientId(e.target.value)}
        className="w-full glass-input rounded-lg px-3 py-2 text-sm"
       >
        <option value="">-- Selectionner un patient --</option>
        {patients.map((p: any) => (
         <option key={p.id} value={p.id}>
          {p.firstName} {p.lastName} ({p.email})
         </option>
        ))}
       </select>
      </div>

      {/* Report type */}
      <div>
       <label className="block text-sm font-medium text-slate-300 mb-1">Type de rapport</label>
       <select
        value={genReportType}
        onChange={(e) => setGenReportType(e.target.value)}
        className="w-full glass-input rounded-lg px-3 py-2 text-sm"
       >
        <option value="HEBDOMADAIRE">Hebdomadaire</option>
        <option value="MENSUEL">Mensuel</option>
        <option value="TRIMESTRIEL">Trimestriel</option>
        <option value="PERSONNALISE">Personnalise</option>
        <option value="URGENCE">Urgence</option>
       </select>
      </div>

      {/* Period mode toggle */}
      <div className="md:col-span-2">
       <label className="block text-sm font-medium text-slate-300 mb-2">Periode</label>
       <div className="flex items-center gap-4 mb-3">
        <label className="flex items-center gap-2 cursor-pointer">
         <input
          type="radio"
          checked={genPeriodMode === 'preset'}
          onChange={() => setGenPeriodMode('preset')}
          className="text-cyan-400 focus:ring-cyan-500"
         />
         <span className="text-sm text-slate-300">Predefinie</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
         <input
          type="radio"
          checked={genPeriodMode === 'custom'}
          onChange={() => setGenPeriodMode('custom')}
          className="text-cyan-400 focus:ring-cyan-500"
         />
         <span className="text-sm text-slate-300">Dates personnalisees</span>
        </label>
       </div>

       {genPeriodMode === 'preset' ? (
        <select
         value={genPeriodDays}
         onChange={(e) => setGenPeriodDays(Number(e.target.value))}
         className="w-full sm:w-auto glass-input rounded-lg px-3 py-2 text-sm"
        >
         <option value={7}>7 jours</option>
         <option value={14}>14 jours</option>
         <option value={30}>30 jours</option>
         <option value={60}>60 jours</option>
         <option value={90}>90 jours</option>
        </select>
       ) : (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
         <input
          type="date"
          value={genDateStart}
          onChange={(e) => setGenDateStart(e.target.value)}
          className="glass-input rounded-lg px-3 py-2 text-sm"
         />
         <span className="text-slate-500 text-sm">au</span>
         <input
          type="date"
          value={genDateEnd}
          onChange={(e) => setGenDateEnd(e.target.value)}
          className="glass-input rounded-lg px-3 py-2 text-sm"
         />
        </div>
       )}
      </div>

      {/* Doctor notes */}
      <div className="md:col-span-2">
       <label className="block text-sm font-medium text-slate-300 mb-1">Notes du medecin</label>
       <textarea
        value={genDoctorNotes}
        onChange={(e) => setGenDoctorNotes(e.target.value)}
        placeholder="Observations, recommandations, commentaires..."
        rows={3}
        className="w-full glass-input rounded-lg px-3 py-2 text-sm resize-none"
       />
      </div>
     </div>

     <div className="flex items-center gap-3 mt-4">
      <button
       onClick={handleGenerate}
       disabled={genLoading || !genPatientId || (genPeriodMode === 'custom' && (!genDateStart || !genDateEnd))}
       className="glow-btn px-6 py-2 rounded-lg disabled:opacity-50 transition text-sm font-medium"
      >
       {genLoading ? 'Generation...' : 'Generer le rapport'}
      </button>
      <button
       onClick={() => setShowGenerate(false)}
       className="text-slate-400 hover:text-slate-300 text-sm transition"
      >
       Annuler
      </button>
     </div>
    </div>
   )}

   {/* Filters and search */}
   <div className="flex flex-col sm:flex-row gap-3 mb-4">
    <input
     type="text"
     value={searchQuery}
     onChange={(e) => setSearchQuery(e.target.value)}
     placeholder="Rechercher par patient..."
     className="flex-1 glass-input rounded-lg px-3 py-2 text-sm"
    />
    <div className="flex items-center bg-cardio-800 rounded-lg p-0.5 shrink-0">
     {(['all', 'signed', 'unsigned'] as const).map((f) => (
      <button
       key={f}
       onClick={() => setFilter(f)}
       className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
        filter === f ? 'glass-card text-slate-100 ' : 'text-slate-400 hover:text-slate-300'
       }`}
      >
       {f === 'all' ? 'Tous' : f === 'signed' ? 'Signes' : 'Non signes'}
      </button>
     ))}
    </div>
   </div>

   <div className="glass-card rounded-xl overflow-hidden">
    {/* Desktop table */}
    <div className="hidden md:block">
     {loading ? (
      <div className="p-12 text-center text-slate-500">Chargement...</div>
     ) : filteredReports.length === 0 ? (
      <div className="p-12 text-center text-slate-500">Aucun rapport disponible</div>
     ) : (
      <table className="w-full">
       <thead className="bg-cardio-800">
        <tr>
         <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Patient</th>
         <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Date</th>
         <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Periode</th>
         <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Type</th>
         <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Risque</th>
         <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Statut</th>
         <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Actions</th>
        </tr>
       </thead>
       <tbody className="divide-y divide-cyan-500/10">
        {filteredReports.map((r: any) => (
         <tr key={r.id} className="hover:bg-cardio-800/50">
          <td className="px-4 py-3 text-sm font-medium">
           {r.patientName || (r.patient?.firstName
            ? `${r.patient.firstName} ${r.patient.lastName || ''}`.trim()
            : r.patientEmail || '--')}
          </td>
          <td className="px-4 py-3 text-sm text-slate-400">
           {r.createdAt ? new Date(r.createdAt).toLocaleDateString('fr-FR') : '--'}
          </td>
          <td className="px-4 py-3 text-sm text-slate-400">
           {formatPeriod(r)}
          </td>
          <td className="px-4 py-3">
           {r.reportType ? reportTypeBadge(r.reportType) : <span className="text-xs text-slate-500">--</span>}
          </td>
          <td className="px-4 py-3">
           {r.riskLevel ? riskBadge(r.riskLevel) : <span className="text-xs text-slate-500">N/A</span>}
          </td>
          <td className="px-4 py-3">
           {r.signedAt ? (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/15 text-green-400">
             Signe
            </span>
           ) : (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-cardio-800 text-slate-400">
             Non signe
            </span>
           )}
          </td>
          <td className="px-4 py-3">
           <div className="flex items-center gap-2">
            <button
             onClick={() => handleDownload(r.id)}
             className="text-cyan-400 hover:text-cyan-300 text-sm font-medium"
            >
             PDF
            </button>
            {!r.signedAt && (
             <button
              onClick={() => {
               if (confirm('Confirmer la signature electronique de ce rapport ?')) {
                handleSign(r.id);
               }
              }}
              disabled={signingId === r.id}
              className="text-green-400 hover:text-green-300 text-sm font-medium disabled:opacity-50"
             >
              {signingId === r.id ? '...' : 'Signer'}
             </button>
            )}
           </div>
          </td>
         </tr>
        ))}
       </tbody>
      </table>
     )}
    </div>

    {/* Mobile cards */}
    <div className="md:hidden">
     {loading ? (
      <div className="p-8 text-center text-slate-500">Chargement...</div>
     ) : filteredReports.length === 0 ? (
      <div className="p-8 text-center text-slate-500">Aucun rapport disponible</div>
     ) : (
      <div className="divide-y divide-cyan-500/10">
       {filteredReports.map((r: any) => (
        <div key={r.id} className="p-4">
         <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-200 truncate mr-2">
           {r.patientName || (r.patient?.firstName
            ? `${r.patient.firstName} ${r.patient.lastName || ''}`.trim()
            : '--')}
          </span>
          <div className="flex items-center gap-1.5">
           {r.signedAt ? (
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-green-500/15 text-green-400">Signe</span>
           ) : (
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-cardio-800 text-slate-400">Non signe</span>
           )}
           {r.riskLevel && riskBadge(r.riskLevel)}
          </div>
         </div>
         <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{formatPeriod(r)}</span>
          <div className="flex items-center gap-3">
           <button onClick={() => handleDownload(r.id)} className="text-cyan-400 font-medium">PDF</button>
           {!r.signedAt && (
            <button
             onClick={() => {
              if (confirm('Signer ce rapport ?')) handleSign(r.id);
             }}
             className="text-green-400 font-medium"
            >
             Signer
            </button>
           )}
          </div>
         </div>
        </div>
       ))}
      </div>
     )}
    </div>
   </div>
  </div>
 );
}
