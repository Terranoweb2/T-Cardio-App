'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import AdvertisementFormModal from '@/components/admin/AdvertisementFormModal';

const FILTERS = [
 { label: 'Tous', value: '' },
 { label: 'Popup', value: 'POPUP' },
 { label: 'Bandeau', value: 'TICKER' },
];

export default function AdminPublicitesPage() {
 const [ads, setAds] = useState<any[]>([]);
 const [meta, setMeta] = useState<any>(null);
 const [page, setPage] = useState(1);
 const [typeFilter, setTypeFilter] = useState('');
 const [formModal, setFormModal] = useState<any>(undefined); // undefined=closed, null=create, object=edit
 const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

 const fetchAds = () => {
  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (typeFilter) params.set('type', typeFilter);
  api.get(`/advertisements/admin?${params.toString()}`)
   .then((r) => { setAds(r.data.data); setMeta(r.data.meta); })
   .catch(() => {});
 };

 useEffect(() => { fetchAds(); }, [page, typeFilter]);

 const toggleActive = async (id: string) => {
  try {
   await api.patch(`/advertisements/${id}/toggle`);
   fetchAds();
  } catch {}
 };

 const deleteAd = async (id: string) => {
  if (!confirm('Supprimer cette publicite ?')) return;
  try {
   await api.delete(`/advertisements/${id}`);
   fetchAds();
   showFeedback('success', 'Publicite supprimee');
  } catch {
   showFeedback('error', 'Erreur lors de la suppression');
  }
 };

 const showFeedback = (type: 'success' | 'error', msg: string) => {
  setFeedback({ type, msg });
  setTimeout(() => setFeedback(null), 3000);
 };

 const handleFormSuccess = () => {
  setFormModal(undefined);
  fetchAds();
  showFeedback('success', 'Publicite enregistree');
 };

 const now = new Date();
 const activePopups = ads.filter((a) => a.type === 'POPUP' && a.isActive && new Date(a.endDate) > now).length;
 const activeTickers = ads.filter((a) => a.type === 'TICKER' && a.isActive && new Date(a.endDate) > now).length;

 return (
  <div>
   <div className="flex items-center justify-between mb-6">
    <h1 className="text-lg sm:text-2xl font-bold">Gestion des publicites</h1>
    <button
     onClick={() => setFormModal(null)}
     className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 transition"
    >
     + Nouvelle publicite
    </button>
   </div>

   {feedback && (
    <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
     feedback.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
    }`}>
     {feedback.msg}
    </div>
   )}

   {/* Stats */}
   <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
    <div className="p-4 rounded-xl bg-purple-500/10 ">
     <p className="text-sm text-slate-400">Total</p>
     <p className="text-2xl font-bold text-purple-400">{meta?.total || 0}</p>
    </div>
    <div className="p-4 rounded-xl bg-cyan-500/10 ">
     <p className="text-sm text-slate-400">Popups actives</p>
     <p className="text-2xl font-bold text-cyan-400">{activePopups}</p>
    </div>
    <div className="p-4 rounded-xl bg-indigo-500/10 ">
     <p className="text-sm text-slate-400">Bandeaux actifs</p>
     <p className="text-2xl font-bold text-indigo-400">{activeTickers}</p>
    </div>
   </div>

   {/* Filters */}
   <div className="flex gap-2 mb-4">
    {FILTERS.map((f) => (
     <button key={f.value} onClick={() => { setTypeFilter(f.value); setPage(1); }}
      className={`px-4 py-2 rounded-lg text-sm transition ${
       typeFilter === f.value ? 'bg-purple-600 text-white' : 'glass-card border text-slate-400 hover:bg-cardio-800/50'
      }`}>
      {f.label}
     </button>
    ))}
   </div>

   {/* Ads table */}
   <div className="glass-card rounded-xl overflow-x-auto">
    <table className="w-full min-w-[800px]">
     <thead className="bg-cardio-800">
      <tr>
       <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Titre</th>
       <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Type</th>
       <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Audience</th>
       <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Periode</th>
       <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Priorite</th>
       <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Actif</th>
       <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Actions</th>
      </tr>
     </thead>
     <tbody className="divide-y divide-cyan-500/10">
      {ads.map((ad) => {
       const isExpired = new Date(ad.endDate) < now;
       return (
        <tr key={ad.id} className={`hover:bg-cardio-800/50 ${isExpired ? 'opacity-50' : ''}`}>
         <td className="px-4 py-3">
          <div className="text-sm font-medium text-slate-100">{ad.title}</div>
          <div className="text-xs text-slate-400 truncate max-w-[200px]">{ad.content}</div>
         </td>
         <td className="px-4 py-3">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
           ad.type === 'POPUP' ? 'bg-purple-500/15 text-purple-400' : 'bg-indigo-500/15 text-indigo-400'
          }`}>
           {ad.type === 'POPUP' ? 'Popup' : 'Bandeau'}
          </span>
         </td>
         <td className="px-4 py-3 text-xs text-slate-400">
          {ad.targetAudience === 'ALL' ? 'Tous' : ad.targetAudience === 'PATIENT' ? 'Patients' : 'Medecins'}
         </td>
         <td className="px-4 py-3 text-xs text-slate-400">
          {new Date(ad.startDate).toLocaleDateString('fr-FR')} - {new Date(ad.endDate).toLocaleDateString('fr-FR')}
          {isExpired && <span className="text-red-500 ml-1">(expire)</span>}
         </td>
         <td className="px-4 py-3 text-sm text-slate-400">{ad.priority}</td>
         <td className="px-4 py-3">
          <button
           onClick={() => toggleActive(ad.id)}
           className={`relative w-10 h-5 rounded-full transition ${ad.isActive ? 'bg-green-500' : 'bg-slate-600'}`}
          >
           <span className={`absolute top-0.5 left-0.5 w-4 h-4 glass-card rounded-full transition-transform ${
            ad.isActive ? 'translate-x-5' : 'translate-x-0'
           }`} />
          </button>
         </td>
         <td className="px-4 py-3">
          <div className="flex gap-1">
           <button onClick={() => setFormModal(ad)}
            className="px-2 py-1 rounded text-xs bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/15 transition">
            Modifier
           </button>
           <button onClick={() => deleteAd(ad.id)}
            className="px-2 py-1 rounded text-xs bg-red-500/10 text-red-400 hover:bg-red-500/15 transition">
            Supprimer
           </button>
          </div>
         </td>
        </tr>
       );
      })}
      {ads.length === 0 && (
       <tr>
        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">Aucune publicite</td>
       </tr>
      )}
     </tbody>
    </table>
   </div>

   {meta && meta.totalPages > 1 && (
    <div className="flex justify-center gap-2 mt-4">
     {Array.from({ length: meta.totalPages }, (_, i) => (
      <button key={i} onClick={() => setPage(i + 1)}
       className={`px-3 py-1 rounded text-sm ${page === i + 1 ? 'bg-purple-600 text-white' : 'glass-card border'}`}>
       {i + 1}
      </button>
     ))}
    </div>
   )}

   {formModal !== undefined && (
    <AdvertisementFormModal
     ad={formModal}
     onClose={() => setFormModal(undefined)}
     onSuccess={handleFormSuccess}
    />
   )}
  </div>
 );
}
