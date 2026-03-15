'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';

interface AdvertisementFormModalProps {
  ad?: any; // null for create, object for edit
  onClose: () => void;
  onSuccess: () => void;
}

export default function AdvertisementFormModal({ ad, onClose, onSuccess }: AdvertisementFormModalProps) {
  const isEdit = !!ad;
  const [form, setForm] = useState({
    type: 'POPUP' as 'POPUP' | 'TICKER',
    title: '',
    content: '',
    imageUrl: '',
    linkUrl: '',
    targetAudience: 'ALL' as 'ALL' | 'PATIENT' | 'MEDECIN',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    priority: 0,
    isActive: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (ad) {
      setForm({
        type: ad.type,
        title: ad.title,
        content: ad.content,
        imageUrl: ad.imageUrl || '',
        linkUrl: ad.linkUrl || '',
        targetAudience: ad.targetAudience,
        startDate: ad.startDate ? new Date(ad.startDate).toISOString().split('T')[0] : '',
        endDate: ad.endDate ? new Date(ad.endDate).toISOString().split('T')[0] : '',
        priority: ad.priority || 0,
        isActive: ad.isActive,
      });
    }
  }, [ad]);

  const update = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError('Le titre est obligatoire'); return; }
    if (!form.content.trim()) { setError('Le contenu est obligatoire'); return; }
    if (!form.startDate || !form.endDate) { setError('Les dates sont obligatoires'); return; }
    if (new Date(form.endDate) <= new Date(form.startDate)) { setError('La date de fin doit etre apres la date de debut'); return; }

    setLoading(true);
    setError('');
    try {
      const payload = {
        ...form,
        imageUrl: form.imageUrl || null,
        linkUrl: form.linkUrl || null,
      };

      if (isEdit) {
        await api.patch(`/advertisements/${ad.id}`, payload);
      } else {
        await api.post('/advertisements', payload);
      }
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="glass-card rounded-2xl w-full max-w-lg my-4">
        <div className="px-6 py-4 border-b border-cyan-500/10">
          <h2 className="text-lg font-semibold text-slate-100">
            {isEdit ? 'Modifier la publicite' : 'Nouvelle publicite'}
          </h2>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto dark-scrollbar">
          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Type</label>
            <div className="flex gap-3">
              <button onClick={() => update('type', 'POPUP')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition ${
                  form.type === 'POPUP' ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300' : 'border-slate-600 text-slate-400'
                }`}>
                Popup
              </button>
              <button onClick={() => update('type', 'TICKER')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition ${
                  form.type === 'TICKER' ? 'border-teal-500 bg-teal-500/15 text-teal-300' : 'border-slate-600 text-slate-400'
                }`}>
                Bandeau defilant
              </button>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Titre</label>
            <input type="text" value={form.title} onChange={(e) => update('title', e.target.value)}
              className="glass-input w-full" placeholder="Titre de la publicite..." />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              {form.type === 'TICKER' ? 'Texte defilant' : 'Contenu'}
            </label>
            <textarea value={form.content} onChange={(e) => update('content', e.target.value)}
              rows={form.type === 'TICKER' ? 2 : 4}
              className="glass-input w-full resize-none"
              placeholder={form.type === 'TICKER' ? 'Message qui defilera...' : 'Corps de la popup...'} />
          </div>

          {/* Image URL (POPUP only) */}
          {form.type === 'POPUP' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Image URL (optionnel)</label>
              <input type="url" value={form.imageUrl} onChange={(e) => update('imageUrl', e.target.value)}
                className="glass-input w-full" placeholder="https://..." />
            </div>
          )}

          {/* Link URL */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Lien URL (optionnel)</label>
            <input type="url" value={form.linkUrl} onChange={(e) => update('linkUrl', e.target.value)}
              className="glass-input w-full" placeholder="https://..." />
          </div>

          {/* Target audience */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Audience cible</label>
            <select value={form.targetAudience} onChange={(e) => update('targetAudience', e.target.value)}
              className="glass-input w-full">
              <option value="ALL">Tous les utilisateurs</option>
              <option value="PATIENT">Patients uniquement</option>
              <option value="MEDECIN">Medecins uniquement</option>
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Date debut</label>
              <input type="date" value={form.startDate} onChange={(e) => update('startDate', e.target.value)}
                className="glass-input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Date fin</label>
              <input type="date" value={form.endDate} onChange={(e) => update('endDate', e.target.value)}
                className="glass-input w-full" />
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Priorite (plus grand = affiche en premier)</label>
            <input type="number" value={form.priority} onChange={(e) => update('priority', parseInt(e.target.value) || 0)}
              className="glass-input w-full" min={0} max={100} />
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => update('isActive', !form.isActive)}
              className={`relative w-11 h-6 rounded-full transition ${form.isActive ? 'bg-green-500' : 'bg-slate-600'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                form.isActive ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
            <span className="text-sm text-slate-300">{form.isActive ? 'Active' : 'Inactive'}</span>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">{error}</div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-cyan-500/10 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:bg-cardio-700/50 rounded-lg transition">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="glow-btn px-4 py-2 text-sm rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Enregistrement...' : isEdit ? 'Modifier' : 'Creer'}
          </button>
        </div>
      </div>
    </div>
  );
}
