'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

export default function AdminAiConfigPage() {
 const [thresholds, setThresholds] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [editForm, setEditForm] = useState<any>({});
 const [saving, setSaving] = useState(false);
 const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

 useEffect(() => {
  api.get('/admin/ai-thresholds')
   .then((r) => setThresholds(r.data))
   .catch(() => {})
   .finally(() => setLoading(false));
 }, []);

 const riskColors: Record<string, string> = {
  FAIBLE: 'border-l-green-500 bg-green-500/10',
  MODERE: 'border-l-yellow-500 bg-amber-500/10',
  ELEVE: 'border-l-orange-500 bg-orange-500/10',
  CRITIQUE: 'border-l-red-500 bg-red-500/10',
 };

 const riskBadge = (level: string) => {
  const colors: Record<string, string> = {
   FAIBLE: 'bg-green-500/15 text-green-400',
   MODERE: 'bg-amber-500/15 text-amber-400',
   ELEVE: 'bg-orange-500/15 text-orange-400',
   CRITIQUE: 'bg-red-500/15 text-red-400',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[level] || 'bg-cardio-800'}`}>{level}</span>;
 };

 const startEdit = (threshold: any) => {
  setEditingId(threshold.id);
  setEditForm({
   systolicMin: threshold.systolicMin,
   systolicMax: threshold.systolicMax,
   diastolicMin: threshold.diastolicMin,
   diastolicMax: threshold.diastolicMax,
   priority: threshold.priority,
   isActive: threshold.isActive,
  });
  setFeedback(null);
 };

 const cancelEdit = () => {
  setEditingId(null);
  setEditForm({});
 };

 const saveEdit = async (id: string) => {
  setSaving(true);
  setFeedback(null);
  try {
   const { data } = await api.patch(`/admin/ai-thresholds/${id}`, editForm);
   setThresholds((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));
   setEditingId(null);
   setEditForm({});
   setFeedback({ type: 'success', message: 'Seuil mis a jour avec succes' });
   setTimeout(() => setFeedback(null), 3000);
  } catch {
   setFeedback({ type: 'error', message: 'Erreur lors de la sauvegarde' });
  } finally {
   setSaving(false);
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
   <h1 className="text-lg sm:text-2xl font-bold mb-6">Configuration des seuils T-Cardio</h1>

   {feedback && (
    <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${
     feedback.type === 'success'
      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
      : 'bg-red-500/10 text-red-400 border border-red-500/20'
    }`}>
     {feedback.message}
    </div>
   )}

   {thresholds.length === 0 ? (
    <div className="glass-card p-12 rounded-xl text-center">
     <p className="text-slate-400">Aucun seuil configure</p>
    </div>
   ) : (
    <div className="space-y-4">
     {thresholds.map((t: any) => (
      <div key={t.id} className={`glass-card rounded-xl border-l-4 ${riskColors[t.riskLevel] || 'border-l-gray-300'}`}>
       <div className="p-5">
        <div className="flex justify-between items-start mb-3">
         <div>
          <h3 className="font-semibold text-lg">{t.name}</h3>
          {t.description && <p className="text-sm text-slate-400 mt-1">{t.description}</p>}
         </div>
         <div className="flex items-center gap-3">
          {riskBadge(t.riskLevel)}
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.isActive ? 'bg-green-500/15 text-green-400' : 'bg-cardio-800 text-slate-400'}`}>
           {t.isActive ? 'Actif' : 'Inactif'}
          </span>
         </div>
        </div>

        {editingId === t.id ? (
         <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           <div>
            <label className="block text-xs text-slate-400 mb-1">Systolique min</label>
            <input type="number" value={editForm.systolicMin ?? ''}
             onChange={(e) => setEditForm({ ...editForm, systolicMin: Number(e.target.value) })}
             className="w-full border rounded-lg px-3 py-2 text-sm" />
           </div>
           <div>
            <label className="block text-xs text-slate-400 mb-1">Systolique max</label>
            <input type="number" value={editForm.systolicMax ?? ''}
             onChange={(e) => setEditForm({ ...editForm, systolicMax: Number(e.target.value) })}
             className="w-full border rounded-lg px-3 py-2 text-sm" />
           </div>
           <div>
            <label className="block text-xs text-slate-400 mb-1">Diastolique min</label>
            <input type="number" value={editForm.diastolicMin ?? ''}
             onChange={(e) => setEditForm({ ...editForm, diastolicMin: Number(e.target.value) })}
             className="w-full border rounded-lg px-3 py-2 text-sm" />
           </div>
           <div>
            <label className="block text-xs text-slate-400 mb-1">Diastolique max</label>
            <input type="number" value={editForm.diastolicMax ?? ''}
             onChange={(e) => setEditForm({ ...editForm, diastolicMax: Number(e.target.value) })}
             className="w-full border rounded-lg px-3 py-2 text-sm" />
           </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
           <div>
            <label className="block text-xs text-slate-400 mb-1">Priorite</label>
            <input type="number" value={editForm.priority ?? ''}
             onChange={(e) => setEditForm({ ...editForm, priority: Number(e.target.value) })}
             className="w-full border rounded-lg px-3 py-2 text-sm" />
           </div>
           <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
             <input type="checkbox" checked={editForm.isActive ?? false}
              onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
              className="rounded" />
             Actif
            </label>
           </div>
          </div>
          <div className="flex gap-2">
           <button onClick={() => saveEdit(t.id)} disabled={saving}
            className="glow-btn px-4 py-2 rounded-lg disabled:opacity-50 transition text-sm">
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
           </button>
           <button onClick={cancelEdit}
            className="bg-cardio-800 text-slate-400 px-4 py-2 rounded-lg hover:bg-cardio-700/50 transition text-sm">
            Annuler
           </button>
          </div>
         </div>
        ) : (
         <div className="flex justify-between items-end mt-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
           <div>
            <span className="text-slate-400">Systolique:</span>{' '}
            <span className="font-medium">{t.systolicMin} - {t.systolicMax}</span>
           </div>
           <div>
            <span className="text-slate-400">Diastolique:</span>{' '}
            <span className="font-medium">{t.diastolicMin} - {t.diastolicMax}</span>
           </div>
           <div>
            <span className="text-slate-400">Priorite:</span>{' '}
            <span className="font-medium">{t.priority}</span>
           </div>
          </div>
          <button onClick={() => startEdit(t)}
           className="bg-cyan-500/15 text-cyan-400 px-3 py-1 rounded text-xs font-medium hover:bg-cyan-500/25 transition">
           Modifier
          </button>
         </div>
        )}
       </div>
      </div>
     ))}
    </div>
   )}
  </div>
 );
}
