'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import ExportButton from '@/components/reports/ExportButton';

export default function ReportsPage() {
 const [reports, setReports] = useState<any[]>([]);
 const [meta, setMeta] = useState<any>(null);
 const [page, setPage] = useState(1);
 const [generating, setGenerating] = useState(false);
 const [downloading, setDownloading] = useState<string | null>(null);

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

 return (
  <div>
   <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
    <h1 className="text-lg sm:text-2xl font-bold">Rapports</h1>
    <div className="flex items-center gap-3">
     <ExportButton variant="compact" />
     <button onClick={handleGenerate} disabled={generating}
      className="glow-btn px-4 py-2 rounded-lg disabled:opacity-50 transition text-sm">
      {generating ? 'Generation en cours...' : 'Generer un rapport'}
     </button>
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
