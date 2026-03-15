'use client';

import { useState } from 'react';
import api from '@/lib/api';

interface ContactDoctorModalProps {
  doctor: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ContactDoctorModal({ doctor, onClose, onSuccess }: ContactDoctorModalProps) {
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'URGENT'>('NORMAL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const doctorName = `Dr. ${doctor.firstName || ''} ${doctor.lastName || ''}`.trim();

  const handleSubmit = async () => {
    if (!subject.trim()) { setError('Le sujet est obligatoire'); return; }
    if (!content.trim()) { setError('Le contenu est obligatoire'); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/admin/messages/doctors', {
        doctorUserId: doctor.userId,
        subject: subject.trim(),
        content: content.trim(),
        priority,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de l\'envoi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-card rounded-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-cyan-500/10">
          <h2 className="text-lg font-semibold text-slate-100">Contacter un medecin</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-slate-300 font-medium">{doctorName}</span>
            <span className="text-xs text-slate-500">({doctor.user?.email})</span>
          </div>
          {doctor.specialty && (
            <span className="text-xs text-teal-400 bg-teal-500/15 px-2 py-0.5 rounded mt-1 inline-block">{doctor.specialty}</span>
          )}
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Priorite</label>
            <div className="flex gap-3">
              <button
                onClick={() => setPriority('NORMAL')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition ${
                  priority === 'NORMAL'
                    ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300'
                    : 'border-slate-600 text-slate-400 hover:border-slate-500'
                }`}
              >
                Normal
              </button>
              <button
                onClick={() => setPriority('URGENT')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition ${
                  priority === 'URGENT'
                    ? 'border-red-500 bg-red-500/15 text-red-400'
                    : 'border-slate-600 text-slate-400 hover:border-slate-500'
                }`}
              >
                Urgent
              </button>
            </div>
            {priority === 'URGENT' && (
              <p className="text-xs text-red-400 mt-1">Les messages urgents sont aussi envoyes par email.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Sujet</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="glass-input w-full"
              placeholder="Objet du message..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Message</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className="glass-input w-full resize-none"
              placeholder="Contenu du message..."
            />
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
            disabled={loading || !subject.trim() || !content.trim()}
            className={`px-4 py-2 text-sm text-white rounded-lg transition disabled:opacity-50 ${
              priority === 'URGENT' ? 'bg-red-600 hover:bg-red-700' : 'glow-btn'
            }`}
          >
            {loading ? 'Envoi...' : 'Envoyer'}
          </button>
        </div>
      </div>
    </div>
  );
}
