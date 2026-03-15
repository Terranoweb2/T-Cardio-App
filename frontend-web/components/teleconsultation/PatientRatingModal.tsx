'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { Star, X } from 'lucide-react';

interface PatientRatingModalProps {
  teleconsultationId: string;
  onClose: () => void;
  onSaved?: () => void;
}

export default function PatientRatingModal({
  teleconsultationId,
  onClose,
  onSaved,
}: PatientRatingModalProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSaving(true);
    setError('');
    try {
      await api.post(`/teleconsultations/${teleconsultationId}/review`, {
        rating,
        comment: comment.trim() || undefined,
      });
      onSaved?.();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de l\'envoi de votre avis');
    } finally {
      setSaving(false);
    }
  };

  const displayRating = hoveredRating || rating;

  const ratingLabels: Record<number, string> = {
    1: 'Tres insatisfait',
    2: 'Insatisfait',
    3: 'Correct',
    4: 'Satisfait',
    5: 'Tres satisfait',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-card rounded-2xl w-full max-w-md">
        {/* Header */}
        <div className="px-6 py-4 border-b border-cyan-500/10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Evaluez votre teleconsultation</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Votre avis nous aide a ameliorer la qualite du service.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-5">
          {/* Star rating */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-9 h-9 transition-colors ${
                      star <= displayRating
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-slate-600'
                    }`}
                  />
                </button>
              ))}
            </div>
            {displayRating > 0 && (
              <p className="text-sm text-slate-300">{ratingLabels[displayRating]}</p>
            )}
          </div>

          {/* Comment */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Commentaire (optionnel)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Partagez votre experience..."
              rows={3}
              className="w-full glass-input rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>

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
            Plus tard
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || rating === 0}
            className="glow-btn px-6 py-2 rounded-lg disabled:opacity-50 transition text-sm font-medium"
          >
            {saving ? 'Envoi...' : 'Envoyer mon avis'}
          </button>
        </div>
      </div>
    </div>
  );
}
