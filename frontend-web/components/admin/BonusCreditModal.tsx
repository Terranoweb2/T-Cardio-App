'use client';

import { useState } from 'react';
import api from '@/lib/api';

interface BonusCreditModalProps {
  user: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BonusCreditModal({ user, onClose, onSuccess }: BonusCreditModalProps) {
  const [amount, setAmount] = useState<number>(1000);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const patientName = user.patient
    ? `${user.patient.firstName || ''} ${user.patient.lastName || ''}`.trim() || user.email
    : user.email;

  const handleSubmit = async () => {
    if (amount <= 0) { setError('Le montant doit etre positif'); return; }
    if (!description.trim()) { setError('La description est obligatoire'); return; }
    setLoading(true);
    setError('');
    try {
      await api.post(`/admin/users/${user.id}/bonus`, {
        amount,
        description: description.trim(),
      });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de l\'ajout du bonus');
    } finally {
      setLoading(false);
    }
  };

  const presets = [500, 1000, 2000, 5000, 10000];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-card rounded-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-cyan-500/10">
          <h2 className="text-lg font-semibold text-slate-100">Accorder un bonus</h2>
          <p className="text-sm text-slate-400 mt-1">{patientName}</p>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Montant du bonus (XOF)</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {presets.map((p) => (
                <button
                  key={p}
                  onClick={() => setAmount(p)}
                  className={`px-3 py-1 text-xs rounded-lg border transition ${
                    amount === p ? 'bg-green-500/15 border-green-500 text-green-400' : 'border-slate-600 text-slate-400 hover:bg-cardio-700/50'
                  }`}
                >
                  {p.toLocaleString()}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
              min={1}
              className="glass-input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="glass-input w-full"
              placeholder="Ex: Bonus de bienvenue, recompense fidelite..."
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
            disabled={loading || amount <= 0 || !description.trim()}
            className="px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Traitement...' : `Accorder ${amount.toLocaleString()} XOF`}
          </button>
        </div>
      </div>
    </div>
  );
}
