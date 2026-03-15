'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface ScheduleFormProps {
  /** Pre-selected patient ID (when opened from patient detail page) */
  preselectedPatientId?: string;
  /** Called after successful scheduling */
  onSuccess?: () => void;
  /** Called when user cancels */
  onCancel?: () => void;
}

export default function ScheduleForm({ preselectedPatientId, onSuccess, onCancel }: ScheduleFormProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(!preselectedPatientId);
  const [patientId, setPatientId] = useState(preselectedPatientId || '');
  const [scheduledAt, setScheduledAt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch patients list (only if no preselected patient)
  useEffect(() => {
    if (preselectedPatientId) return;
    setLoadingPatients(true);
    api.get('/doctors/patients')
      .then((r) => {
        const data = r.data.data || r.data || [];
        setPatients(Array.isArray(data) ? data : []);
      })
      .catch(() => {})
      .finally(() => setLoadingPatients(false));
  }, [preselectedPatientId]);

  // Set default date/time to tomorrow at 10:00
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const local = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setScheduledAt(local);
  }, []);

  const handleSubmit = async () => {
    if (!patientId || !scheduledAt) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await api.post('/teleconsultations', {
        patientId,
        scheduledAt: new Date(scheduledAt).toISOString(),
        durationMinutes,
        reason: reason.trim() || undefined,
      });
      setMessage({ type: 'success', text: 'Teleconsultation planifiee avec succes' });
      setReason('');
      setTimeout(() => {
        onSuccess?.();
      }, 1000);
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Erreur lors de la planification',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass-card rounded-xl p-5 sm:p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Planifier une teleconsultation</h2>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-slate-500 hover:text-slate-400 transition"
            title="Fermer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Patient selector */}
        {!preselectedPatientId && (
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-1">Patient *</label>
            {loadingPatients ? (
              <div className="text-sm text-slate-500">Chargement des patients...</div>
            ) : (
              <select
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="w-full glass-input rounded-lg px-3 py-2 text-sm"
              >
                <option value="">-- Selectionner un patient --</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName} ({p.email})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Date/time */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Date et heure *</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full glass-input rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {/* Duration */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Duree</label>
          <select
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            className="w-full glass-input rounded-lg px-3 py-2 text-sm"
          >
            <option value={15}>15 minutes</option>
            <option value={20}>20 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={45}>45 minutes</option>
            <option value={60}>1 heure</option>
          </select>
        </div>

        {/* Reason */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-300 mb-1">Motif</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motif de la teleconsultation..."
            rows={2}
            className="w-full glass-input rounded-lg px-3 py-2 text-sm resize-none"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-4">
        <button
          onClick={handleSubmit}
          disabled={submitting || !patientId || !scheduledAt}
          className="glow-btn px-6 py-2 rounded-lg disabled:opacity-50 transition text-sm font-medium"
        >
          {submitting ? 'Planification...' : 'Planifier la teleconsultation'}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-300 text-sm transition"
          >
            Annuler
          </button>
        )}
      </div>

      {/* Message */}
      {message && (
        <p className={`text-sm mt-3 ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
