'use client';

import { useState } from 'react';
import api from '@/lib/api';

interface GrantSubscriptionModalProps {
  user: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function GrantSubscriptionModal({ user, onClose, onSuccess }: GrantSubscriptionModalProps) {
  const [plan, setPlan] = useState('BASIC');
  const [durationDays, setDurationDays] = useState(365);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const patientName = user.patient
    ? `${user.patient.firstName || ''} ${user.patient.lastName || ''}`.trim() || user.email
    : user.email;

  const activeSub = user.patient?.subscriptions?.[0];

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post(`/admin/users/${user.id}/grant-subscription`, {
        plan,
        durationDays,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de l\'attribution');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-card rounded-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-cyan-500/10">
          <h2 className="text-lg font-semibold text-slate-100">Accorder un abonnement</h2>
          <p className="text-sm text-slate-400 mt-1">{patientName}</p>
        </div>

        <div className="px-6 py-5 space-y-4">
          {activeSub && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm text-amber-300">
              Abonnement actif : <span className="font-medium">{activeSub.plan}</span>
              {' '}(expire le {new Date(activeSub.endDate).toLocaleDateString('fr-FR')})
              — Il sera remplace.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Plan</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPlan('BASIC')}
                className={`p-3 rounded-xl border-2 text-center transition ${
                  plan === 'BASIC' ? 'border-cyan-500 bg-cyan-500/15' : 'border-slate-600 hover:border-slate-500'
                }`}
              >
                <div className="text-sm font-semibold text-slate-200">Basique</div>
                <div className="text-xs text-slate-400 mt-1">Acces standard</div>
              </button>
              <button
                onClick={() => setPlan('PRO')}
                className={`p-3 rounded-xl border-2 text-center transition ${
                  plan === 'PRO' ? 'border-teal-500 bg-teal-500/15' : 'border-slate-600 hover:border-slate-500'
                }`}
              >
                <div className="text-sm font-semibold text-slate-200">Professionnel</div>
                <div className="text-xs text-slate-400 mt-1">Acces complet</div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Duree (jours)</label>
            <div className="flex gap-2 mb-2">
              {[30, 90, 180, 365].map((d) => (
                <button
                  key={d}
                  onClick={() => setDurationDays(d)}
                  className={`px-3 py-1 text-xs rounded-lg border transition ${
                    durationDays === d ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300' : 'border-slate-600 text-slate-400 hover:bg-cardio-700/50'
                  }`}
                >
                  {d === 365 ? '1 an' : d === 180 ? '6 mois' : d === 90 ? '3 mois' : '1 mois'}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={durationDays}
              onChange={(e) => setDurationDays(parseInt(e.target.value) || 30)}
              min={1}
              max={3650}
              className="glass-input w-full"
            />
          </div>

          <div className="bg-cardio-800/50 rounded-lg p-3 text-sm text-slate-400 border border-cyan-500/10">
            L'abonnement <span className="font-medium text-slate-300">{plan === 'BASIC' ? 'Basique' : 'Professionnel'}</span> sera
            actif pendant <span className="font-medium text-slate-300">{durationDays} jours</span> (gratuit, sans paiement).
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
            {loading ? 'Attribution...' : 'Accorder l\'abonnement'}
          </button>
        </div>
      </div>
    </div>
  );
}
