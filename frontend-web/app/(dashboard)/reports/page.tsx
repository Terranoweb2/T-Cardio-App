'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import ExportButton from '@/components/reports/ExportButton';
import { FileText, Download, Loader2, FolderOpen, FileCheck } from 'lucide-react';

export default function ReportsPage() {
 const [reports, setReports] = useState<any[]>([]);
 const [meta, setMeta] = useState<any>(null);
 const [page, setPage] = useState(1);
 const [generating, setGenerating] = useState(false);
 const [downloading, setDownloading] = useState<string | null>(null);
 const [downloadingMedFile, setDownloadingMedFile] = useState(false);

 const fetchReports = () => {
  api.get(`/reports/my?page=${page}&limit=20`)
   .then((r) => {
    const list = r.data.data || r.data || [];
    setReports(Array.isArray(list) ? list : []);
    setMeta(r.data.meta || null);
   })
   .catch(() => {});
 };

 useEffect(() => {
  fetchReports();
 }, [page]);

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

 const handleGenerate = async () => {
  setGenerating(true);
  try {
   await api.post('/reports/generate/my', { periodDays: 30 });
   fetchReports();
  } catch {
  } finally {
   setGenerating(false);
  }
 };

 const handleDownload = async (reportId: string) => {
  setDownloading(reportId);
  try {
   const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
   const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
   const downloadUrl = `${baseURL}/reports/${reportId}/download?token=${token}`;

   // Fetch PDF as blob via authenticated request
   const response = await fetch(downloadUrl);
   if (!response.ok) throw new Error('Download failed');
   const blob = await response.blob();

   // Convert blob to base64 data URI — works in WebView + browser
   const reader = new FileReader();
   reader.onloadend = () => {
    const dataUrl = reader.result as string;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `rapport-tcardio-${reportId}.pdf`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => document.body.removeChild(link), 2000);
   };
   reader.readAsDataURL(blob);
  } catch (err) {
   console.error('Download error:', err);
   // Fallback: open URL directly
   const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
   const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
   window.open(`${baseURL}/reports/${reportId}/download?token=${token}`, '_blank');
  } finally {
   setDownloading(null);
  }
 };

 const handleDownloadMedicalFile = async () => {
  setDownloadingMedFile(true);
  try {
   const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
   const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
   const response = await fetch(`${baseURL}/reports/complete-medical-file`, {
    headers: { Authorization: `Bearer ${token}` },
   });
   if (!response.ok) throw new Error('Download failed');
   const blob = await response.blob();
   const reader = new FileReader();
   reader.onloadend = () => {
    const link = document.createElement('a');
    link.href = reader.result as string;
    link.download = `dossier-medical-complet-${new Date().toISOString().slice(0, 10)}.pdf`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => document.body.removeChild(link), 2000);
   };
   reader.readAsDataURL(blob);
  } catch (err) {
   console.error('Medical file download error:', err);
  } finally {
   setDownloadingMedFile(false);
  }
 };

 return (
  <div>
   <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
    <h1 className="text-lg sm:text-2xl font-bold text-gradient-cyan">Rapports</h1>
    <div className="flex items-center gap-3">
     <ExportButton variant="compact" />
     <button onClick={handleGenerate} disabled={generating}
      className="glow-btn px-4 py-2 rounded-lg disabled:opacity-50 transition text-sm">
      {generating ? 'Generation en cours...' : 'Generer un rapport'}
     </button>
    </div>
   </div>

   {/* Medical File Export Card */}
   <div className="glass-card rounded-xl p-4 sm:p-6 mb-6 border border-cyan-500/10">
    <div className="flex items-start gap-4">
     <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
      <FolderOpen className="w-6 h-6 text-cyan-400" />
     </div>
     <div className="flex-1 min-w-0">
      <h2 className="font-semibold text-slate-200 mb-1">Dossier medical complet</h2>
      <p className="text-xs sm:text-sm text-slate-400 mb-3">
       Exportez l&apos;integralite de votre dossier : mesures, analyses IA, ordonnances, resultats d&apos;examens et historique medical en un seul PDF.
      </p>
      <button
       onClick={handleDownloadMedicalFile}
       disabled={downloadingMedFile}
       className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 transition text-sm font-medium disabled:opacity-50"
      >
       {downloadingMedFile ? (
        <><Loader2 className="w-4 h-4 animate-spin" /> Generation en cours...</>
       ) : (
        <><Download className="w-4 h-4" /> Telecharger mon dossier complet</>
       )}
      </button>
     </div>
    </div>
   </div>

   {generating && (
    <div className="bg-cyan-500/10 border border-cyan-500/20 p-4 rounded-xl mb-6">
     <div className="flex items-center gap-3">
      <div className="animate-spin h-5 w-5 border-2 border-cyan-400 border-t-transparent rounded-full"></div>
      <p className="text-cyan-400 text-sm">Generation du rapport en cours, veuillez patienter...</p>
     </div>
    </div>
   )}

   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {reports.length === 0 ? (
     <div className="col-span-2 glass-card p-12 rounded-xl text-center">
      <p className="text-slate-500 mb-4">Aucun rapport disponible</p>
      <button onClick={handleGenerate} disabled={generating}
       className="glow-btn px-6 py-2 rounded-lg transition">
       Generer mon premier rapport
      </button>
     </div>
    ) : (
     reports.map((report: any) => (
      <div key={report.id} className="glass-card p-6 rounded-xl">
       <div className="flex justify-between items-start mb-3">
        <div>
         <h3 className="font-semibold text-slate-200">
          {report.periodStart && report.periodEnd
           ? `Rapport du ${new Date(report.periodStart).toLocaleDateString('fr-FR')} au ${new Date(report.periodEnd).toLocaleDateString('fr-FR')}`
           : report.title || report.filename || 'Rapport'}
         </h3>
         <p className="text-xs text-slate-500 mt-1">
          {new Date(report.createdAt).toLocaleDateString('fr-FR')}
         </p>
        </div>
        {report.riskLevel && riskBadge(report.riskLevel)}
       </div>
       {report.periodDays && (
        <p className="text-sm text-slate-400 mb-3">Periode: {report.periodDays} jours</p>
       )}
       <button onClick={() => handleDownload(report.id)}
        disabled={downloading === report.id}
        className="text-cyan-400 hover:text-cyan-300 text-sm font-medium transition disabled:opacity-50 flex items-center gap-2">
        {downloading === report.id ? (
         <>
          <div className="animate-spin h-4 w-4 border-2 border-cyan-400 border-t-transparent rounded-full"></div>
          Telechargement...
         </>
        ) : (
         'Telecharger le rapport'
        )}
       </button>
      </div>
     ))
    )}
   </div>

   {meta && meta.totalPages > 1 && (
    <div className="flex justify-center gap-2 mt-4">
     {Array.from({ length: meta.totalPages }, (_, i) => (
      <button key={i} onClick={() => setPage(i + 1)}
       className={`px-3 py-1 rounded text-sm ${page === i + 1 ? 'glow-btn' : 'glass-card border'}`}>
       {i + 1}
      </button>
     ))}
    </div>
   )}
  </div>
 );
}
