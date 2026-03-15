'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface EmergencyEvent {
  id: string;
  status: string;
  triggerType: string;
  triggerValue: any;
  createdAt: string;
  acknowledgedAt?: string;
  patient?: { id: string; firstName?: string; lastName?: string };
}

export default function DoctorUrgencesPage() {
  const router = useRouter();
  const [emergencies, setEmergencies] = useState<EmergencyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [callbackLoading, setCallbackLoading] = useState<string | null>(null);

  const fetchEmergencies = () => {
    setLoading(true);
    api.get('/emergency-calls/doctor')
      .then(r => setEmergencies(Array.isArray(r.data) ? r.data : []))
      .catch(() => setEmergencies([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEmergencies();
  }, []);

  const handleAcknowledge = async (eventId: string) => {
    setActionLoading(eventId);
    try {
      await api.post(`/emergency-calls/${eventId}/acknowledge`);
      fetchEmergencies();
    } catch {
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefuse = async (eventId: string) => {
    setActionLoading(eventId);
    try {
      await api.post(`/emergency-calls/${eventId}/refuse`);
      fetchEmergencies();
    } catch {
    } finally {
      setActionLoading(null);
    }
  };

  const handleCallback = async (eventId: string) => {
    setCallbackLoading(eventId);
    try {
      const res = await api.post(`/emergency-calls/${eventId}/callback`);
      const teleconsultationId = res.data?.teleconsultationId;
      if (teleconsultationId) {
        router.push(`/teleconsultations/${teleconsultationId}`);
      } else {
        fetchEmergencies();
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Erreur lors du rappel';
      alert(msg);
    } finally {
      setCallbackLoading(null);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      ACTIVE: { label: 'En attente', color: 'bg-red-500/15 text-red-400 animate-pulse' },
      ACKNOWLEDGED: { label: 'Accepte', color: 'bg-green-500/15 text-green-400' },
      RESOLVED: { label: 'Expire', color: 'bg-cardio-800 text-slate-400' },
      FALSE_POSITIVE: { label: 'Faux positif', color: 'bg-amber-500/15 text-amber-400' },
    };
    const s = map[status] || { label: status, color: 'bg-cardio-800 text-slate-400' };
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.color}`}>{s.label}</span>;
  };

  const canCallback = (e: EmergencyEvent) => {
    const data = e.triggerValue || {};
    if (e.status !== 'ACKNOWLEDGED') return false;
    if (data.emergencyType !== 'paid') return false;
    if (data.callbackUsed) return false;
    // Check 1h window
    if (e.acknowledgedAt) {
      const elapsed = Date.now() - new Date(e.acknowledgedAt).getTime();
      if (elapsed > 60 * 60 * 1000) return false;
    }
    return true;
  };

  const getCallbackTimeLeft = (e: EmergencyEvent) => {
    if (!e.acknowledgedAt) return '';
    const elapsed = Date.now() - new Date(e.acknowledgedAt).getTime();
    const remaining = 60 * 60 * 1000 - elapsed;
    if (remaining <= 0) return '';
    const min = Math.ceil(remaining / 60_000);
    return `${min} min restantes`;
  };

  const activeEmergencies = emergencies.filter(e => e.status === 'ACTIVE');
  const acknowledgedEmergencies = emergencies.filter(e => e.status === 'ACKNOWLEDGED');
  const pastEmergencies = emergencies.filter(e => e.status !== 'ACTIVE' && e.status !== 'ACKNOWLEDGED');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Appels d&apos;urgence</h1>

      {/* Active emergencies */}
      {activeEmergencies.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            Urgences en cours ({activeEmergencies.length})
          </h2>
          <div className="space-y-3">
            {activeEmergencies.map(e => {
              const data = e.triggerValue || {};
              const patientName = e.patient
                ? `${e.patient.firstName || ''} ${e.patient.lastName || ''}`.trim() || 'Patient'
                : 'Patient';
              const isPaid = data.emergencyType === 'paid';
              return (
                <div key={e.id} className={`glass-card border rounded-xl p-4 sm:p-5 ${isPaid ? 'border-red-500/30 animate-pulse' : 'border-red-500/20'}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                        <span className="font-bold text-red-300">URGENCE {isPaid ? 'PAYANTE' : 'GRATUITE'}</span>
                      </div>
                      <p className="text-sm font-medium">{patientName}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(e.createdAt).toLocaleString('fr-FR')}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleAcknowledge(e.id)}
                        disabled={actionLoading === e.id}
                        className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition disabled:opacity-50"
                      >
                        {actionLoading === e.id ? '...' : 'Accepter'}
                      </button>
                      <button
                        onClick={() => handleRefuse(e.id)}
                        disabled={actionLoading === e.id}
                        className="bg-red-900 hover:bg-red-800 border border-red-500/30 text-white px-4 py-2 rounded-lg text-sm font-bold transition disabled:opacity-50"
                      >
                        {actionLoading === e.id ? '...' : 'Refuser'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Acknowledged emergencies — with callback button */}
      {acknowledgedEmergencies.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-green-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Urgences acceptees ({acknowledgedEmergencies.length})
          </h2>
          <div className="space-y-3">
            {acknowledgedEmergencies.map(e => {
              const data = e.triggerValue || {};
              const patientName = e.patient
                ? `${e.patient.firstName || ''} ${e.patient.lastName || ''}`.trim() || 'Patient'
                : 'Patient';
              const isPaid = data.emergencyType === 'paid';
              const showCallback = canCallback(e);
              const callbackDone = data.callbackUsed === true;
              const timeLeft = getCallbackTimeLeft(e);

              return (
                <div key={e.id} className="glass-card border border-green-500/20 rounded-xl p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-green-300">
                          {isPaid ? 'URGENCE PAYANTE' : 'URGENCE GRATUITE'} — Acceptee
                        </span>
                        {statusBadge(e.status)}
                      </div>
                      <p className="text-sm font-medium">{patientName}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Acceptee le {e.acknowledgedAt ? new Date(e.acknowledgedAt).toLocaleString('fr-FR') : '--'}
                      </p>
                      {isPaid && callbackDone && (
                        <p className="text-xs text-cyan-400 mt-1 flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                          </svg>
                          Rappel effectue
                        </p>
                      )}
                      {isPaid && showCallback && timeLeft && (
                        <p className="text-xs text-amber-400 mt-1">{timeLeft} pour rappeler</p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {showCallback && (
                        <button
                          onClick={() => handleCallback(e.id)}
                          disabled={callbackLoading === e.id}
                          className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition disabled:opacity-50 flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                          </svg>
                          {callbackLoading === e.id ? 'Connexion...' : 'Rappeler le patient'}
                        </button>
                      )}
                      {callbackDone && data.callbackTeleconsultationId && (
                        <button
                          onClick={() => router.push(`/teleconsultations/${data.callbackTeleconsultationId}`)}
                          className="bg-cardio-800 hover:bg-cardio-700 border border-cyan-500/20 text-cyan-400 px-4 py-2 rounded-lg text-sm font-medium transition"
                        >
                          Ouvrir la consultation
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Past emergencies */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="px-4 sm:px-6 py-3 bg-cardio-800 border-b border-cyan-500/10">
          <h3 className="font-semibold text-sm">Historique des urgences</h3>
        </div>
        {pastEmergencies.length === 0 && activeEmergencies.length === 0 && acknowledgedEmergencies.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            Aucun appel d&apos;urgence recu
          </div>
        ) : pastEmergencies.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-sm">
            Aucun historique
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <table className="w-full">
                <thead className="bg-cardio-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Patient</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-500/10">
                  {pastEmergencies.map(e => {
                    const data = e.triggerValue || {};
                    const patientName = e.patient
                      ? `${e.patient.firstName || ''} ${e.patient.lastName || ''}`.trim() || '--'
                      : '--';
                    return (
                      <tr key={e.id}>
                        <td className="px-4 py-3 text-sm">{patientName}</td>
                        <td className="px-4 py-3 text-sm text-slate-400">
                          {new Date(e.createdAt).toLocaleString('fr-FR')}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`text-xs font-medium ${data.emergencyType === 'paid' ? 'text-amber-400' : 'text-slate-400'}`}>
                            {data.emergencyType === 'paid' ? 'Payant' : 'Gratuit'}
                          </span>
                        </td>
                        <td className="px-4 py-3">{statusBadge(e.status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-cyan-500/10">
              {pastEmergencies.map(e => {
                const data = e.triggerValue || {};
                const patientName = e.patient
                  ? `${e.patient.firstName || ''} ${e.patient.lastName || ''}`.trim() || 'Patient'
                  : 'Patient';
                return (
                  <div key={e.id} className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate mr-2">{patientName}</span>
                      {statusBadge(e.status)}
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{new Date(e.createdAt).toLocaleString('fr-FR')}</span>
                      <span className={data.emergencyType === 'paid' ? 'text-amber-400' : ''}>
                        {data.emergencyType === 'paid' ? 'Payant' : 'Gratuit'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
