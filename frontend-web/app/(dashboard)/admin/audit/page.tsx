'use client';

import { Fragment, useEffect, useState } from 'react';
import api from '@/lib/api';

const RESOURCE_TYPES = [
 { label: 'Tous', value: '' },
 { label: 'Utilisateur', value: 'user' },
 { label: 'Verification medecin', value: 'doctor_verification' },
 { label: 'Seuil T-Cardio', value: 'ai_threshold' },
 { label: 'Mesure', value: 'measurement' },
];

export default function AdminAuditPage() {
 const [logs, setLogs] = useState<any[]>([]);
 const [meta, setMeta] = useState<any>(null);
 const [page, setPage] = useState(1);
 const [resourceType, setResourceType] = useState('');
 const [expandedId, setExpandedId] = useState<string | null>(null);

 useEffect(() => {
  const params = new URLSearchParams({ page: String(page), limit: '50' });
  if (resourceType) params.set('resourceType', resourceType);
  api.get(`/admin/audit-logs?${params.toString()}`)
   .then((r) => { setLogs(r.data.data); setMeta(r.data.meta); })
   .catch(() => {});
 }, [page, resourceType]);

 const actionBadge = (action: string) => {
  const colors: Record<string, string> = {
   CREATE: 'bg-green-500/15 text-green-400',
   UPDATE: 'bg-cyan-500/15 text-cyan-400',
   DELETE: 'bg-red-500/15 text-red-400',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[action] || 'bg-cardio-800'}`}>{action}</span>;
 };

 const truncateJson = (details: any) => {
  if (!details) return '-';
  const str = typeof details === 'string' ? details : JSON.stringify(details);
  return str.length > 60 ? str.substring(0, 60) + '...' : str;
 };

 const formatDetails = (details: any) => {
  if (!details) return '-';
  try {
   const obj = typeof details === 'string' ? JSON.parse(details) : details;
   return JSON.stringify(obj, null, 2);
  } catch {
   return String(details);
  }
 };

 return (
  <div>
   <h1 className="text-2xl font-bold mb-6">Journal d'audit</h1>

   <div className="flex gap-2 mb-4 flex-wrap">
    {RESOURCE_TYPES.map((rt) => (
     <button key={rt.value} onClick={() => { setResourceType(rt.value); setPage(1); }}
      className={`px-4 py-1 rounded-lg text-sm ${resourceType === rt.value ? 'glow-btn' : 'glass-card border text-slate-400'}`}>
      {rt.label}
     </button>
    ))}
   </div>

   <div className="glass-card rounded-xl overflow-hidden">
    <table className="w-full">
     <thead className="bg-cardio-800">
      <tr>
       <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Date</th>
       <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Utilisateur</th>
       <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Role</th>
       <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Action</th>
       <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Ressource</th>
       <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">ID Ressource</th>
       <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Details</th>
      </tr>
     </thead>
     <tbody className="divide-y divide-cyan-500/10">
      {logs.map((log: any) => (
       <Fragment key={log.id}>
        <tr className="hover:bg-cardio-800/50">
         <td className="px-4 py-3 text-sm text-slate-400">
          {new Date(log.createdAt || log.date).toLocaleString('fr-FR')}
         </td>
         <td className="px-4 py-3 text-sm">{log.userId || '-'}</td>
         <td className="px-4 py-3 text-sm text-slate-400">{log.userRole || '-'}</td>
         <td className="px-4 py-3">{actionBadge(log.action)}</td>
         <td className="px-4 py-3 text-sm">
          <span className="bg-cardio-800 px-2 py-0.5 rounded text-xs">{log.resourceType}</span>
         </td>
         <td className="px-4 py-3 text-sm text-slate-400 font-mono text-xs">{log.resourceId || '-'}</td>
         <td className="px-4 py-3 text-sm">
          {log.details ? (
           <button
            onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
            className="text-cyan-400 hover:text-cyan-300 text-xs underline"
           >
            {expandedId === log.id ? 'Masquer' : truncateJson(log.details)}
           </button>
          ) : (
           <span className="text-slate-500">-</span>
          )}
         </td>
        </tr>
        {expandedId === log.id && log.details && (
         <tr key={`${log.id}-details`}>
          <td colSpan={7} className="px-4 py-3 bg-cardio-800/50">
           <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono bg-cardio-800 p-3 rounded-lg overflow-x-auto">
            {formatDetails(log.details)}
           </pre>
          </td>
         </tr>
        )}
       </Fragment>
      ))}
      {logs.length === 0 && (
       <tr>
        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
         Aucune entree dans le journal
        </td>
       </tr>
      )}
     </tbody>
    </table>
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
