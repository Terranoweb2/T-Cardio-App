'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

export default function AiAnalysisPage() {
 const [analysis, setAnalysis] = useState<any>(null);
 const [loading, setLoading] = useState(false);

 useEffect(() => {
  api.get('/ai/latest').then((r) => setAnalysis(r.data)).catch(() => {});
 }, []);

 const runAnalysis = async () => {
  setLoading(true);
  try {
   const { data } = await api.post('/ai/analyze', { days: 30 });
   setAnalysis(data);
  } catch {
  } finally {
   setLoading(false);
  }
 };

 const riskColors: Record<string, string> = {
  FAIBLE: 'bg-green-500/15 text-green-400 border-green-500/20',
  MODERE: 'bg-amber-500/15 text-amber-400 border-yellow-300',
  ELEVE: 'bg-red-500/15 text-red-400 border-red-500/20',
  CRITIQUE: 'bg-red-500/20 text-red-300 border-red-500/30',
 };

 return (
  <div>
   <div className="flex justify-between items-center mb-4 sm:mb-6 flex-wrap gap-2">
    <h1 className="text-lg sm:text-2xl font-bold">Analyse T-Cardio</h1>
    <button onClick={runAnalysis} disabled={loading}
     className="glow-btn px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg disabled:opacity-50 transition text-xs sm:text-sm">
     {loading ? 'Analyse en cours...' : 'Lancer une analyse'}
    </button>
   </div>

   {analysis ? (
    <div className="space-y-6">
     <div className={`p-4 rounded-xl border ${riskColors[analysis.riskLevel] || 'bg-cardio-800'}`}>
      <p className="text-lg font-semibold">Niveau de risque: {analysis.riskLevel}</p>
      {analysis.confidenceScore && <p className="text-sm mt-1">Confiance: {Math.round(analysis.confidenceScore * 100)}%</p>}
     </div>

     {analysis.patientSummary && (
      <div className="glass-card p-3 sm:p-6 rounded-xl shadow">
       <h2 className="font-semibold mb-3">Resume pour vous</h2>
       <p className="text-slate-300 whitespace-pre-line">{analysis.patientSummary}</p>
      </div>
     )}

     {analysis.alerts && analysis.alerts.length > 0 && (
      <div className="glass-card p-3 sm:p-6 rounded-xl shadow">
       <h2 className="font-semibold mb-3">Alertes</h2>
       <ul className="space-y-2">
        {analysis.alerts.map((alert: any, i: number) => (
         <li key={i} className="flex items-start gap-2">
          <span className={`px-2 py-0.5 rounded text-xs ${riskColors[alert.severity] || ''}`}>{alert.severity}</span>
          <span className="text-sm">{alert.message}</span>
         </li>
        ))}
       </ul>
      </div>
     )}

     {analysis.projections && (
      <div className="glass-card p-3 sm:p-6 rounded-xl shadow">
       <h2 className="font-semibold mb-3">Projections</h2>
       <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-sm">
        {['30d', '60d', '90d'].map((period) => (
         analysis.projections[period] && (
          <div key={period} className="text-center p-2 sm:p-3 bg-cardio-800/50 rounded-lg">
           <p className="font-medium">{period}</p>
           <p>Tendance: {analysis.projections[period].systolic_trend}</p>
           <p>Moy. estimee: {analysis.projections[period].estimated_avg}</p>
          </div>
         )
        ))}
       </div>
      </div>
     )}

     <p className="text-xs text-slate-500">
      Cette analyse est generee par T-Cardio. Elle ne remplace pas l'avis de votre medecin.
      {analysis.createdAt && ` Generee le ${new Date(analysis.createdAt).toLocaleString('fr-FR')}`}
     </p>
    </div>
   ) : (
    <div className="glass-card p-12 rounded-xl text-center">
     <p className="text-slate-400 mb-4">Aucune analyse disponible</p>
     <button onClick={runAnalysis} disabled={loading}
      className="glow-btn px-6 py-2 rounded-lg transition">
      Lancer ma premiere analyse
     </button>
    </div>
   )}
  </div>
 );
}
