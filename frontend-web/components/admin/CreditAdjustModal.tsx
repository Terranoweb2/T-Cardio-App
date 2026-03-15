'use client';

import { useState } from 'react';
import api from '@/lib/api';

interface CreditAdjustModalProps {
  user: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreditAdjustModal({ user, onClose, onSuccess }: CreditAdjustModalProps) {
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const patientName = user.patient
    ? `${user.patient.firstName || ''} ${user.patient.lastName || ''}`.trim() || user.email
    : user.email;
  const currentBalance = user.patient?.creditBalance?.balance ?? 0;

  const handleSubmit = async () => {
    if (amount === 0) { setError('Le montant ne peut pas etre 0'); return; }
    if (!reason.trim()) { setError('La raison est obligatoire'); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/credits/admin/adjust', {
        patientId: user.patient.id,
        amount,
        reason: reason.trim(),
      });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de l\'ajustement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-card rounded-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-cyan-500/10">
          <h2 className="text-lg font-semibold text-slate-100">Ajustement de credits</h2>
          <p className="text-sm text-slate-400 mt-1">{patientName} ({user.email})</p>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="bg-cyan-500/10 rounded-lg p-3 flex items-center justify-between border border-cyan-500/10">
            <span className="text-sm text-cyan-300">Solde actuel</span>
            <span className="text-lg font-bold text-cyan-400">{currentBalance.toLocaleString()} XOF</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Montant (positif ou negatif)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
              className="glass-input w-full"
              placeholder="Ex: 5000 ou -1000"
            />
            {amount !== 0 && (
              <p className={`text-xs mt-1 ${amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                Nouveau solde : {(currentBalance + amount).toLocaleString()} XOF
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Raison</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="glass-input w-full"
              placeholder="Motif de l'ajustement..."
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
            disabled={loading || amount === 0 || !reason.trim()}
            className="glow-btn px-4 py-2 text-sm rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Traitement...' : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  );
}
