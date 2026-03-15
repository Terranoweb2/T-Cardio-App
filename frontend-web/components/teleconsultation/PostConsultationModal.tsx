'use client';

import { useState } from 'react';
import api from '@/lib/api';

interface PostConsultationModalProps {
  teleconsultationId: string;
  onClose: () => void;
  onSaved?: () => void;
}

export default function PostConsultationModal({
  teleconsultationId,
  onClose,
  onSaved,
}: PostConsultationModalProps) {
  const [summary, setSummary] = useState('');
  const [followUpNeeded, setFollowUpNeeded] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!summary.trim()) return;
    setSaving(true);
    setError('');
    try {
      await api.patch(`/teleconsultations/${teleconsultationId}/summary`, {
        summary: summary.trim(),
        followUpNeeded,
        followUpDate: followUpDate || undefined,
      });
      onSaved?.();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-card rounded-2xl w-full max-w-lg">
        {/* Header */}
        <div className="px-6 py-4 border-b border-cyan-500/10">
          <h2 className="text-lg font-semibold text-slate-100">Resume de la consultation</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Redigez un resume de la teleconsultation pour le dossier medical.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Summary textarea */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Resume de la consultation *
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Observations, recommandations, points discutes..."
              rows={5}
              className="w-full glass-input rounded-lg px-3 py-2 text-sm resize-none"
              autoFocus
            />
          </div>

          {/* Follow-up checkbox */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="followUp"
              checked={followUpNeeded}
              onChange={(e) => setFollowUpNeeded(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-cyan-500/15 text-cyan-400 focus:ring-cyan-500 bg-cardio-800"
            />
            <label htmlFor="followUp" className="text-sm text-slate-300 cursor-pointer">
              Suivi necessaire
            </label>
          </div>

          {/* Follow-up date (conditional) */}
          {followUpNeeded && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Date de suivi
              </label>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="w-full glass-input rounded-lg px-3 py-2 text-sm"
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-cyan-500/10 flex flex-col sm:flex-row justify-end gap-3">
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-300 px-4 py-2 text-sm transition"
          >
            Passer
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !summary.trim()}
            className="glow-btn px-6 py-2 rounded-lg disabled:opacity-50 transition text-sm font-medium"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer le resume'}
          </button>
        </div>
      </div>
    </div>
  );
}
