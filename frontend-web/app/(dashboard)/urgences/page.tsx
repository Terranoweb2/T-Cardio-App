'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { getDoctorLabel } from '@/lib/doctor-label';
import EmergencyConfirmationModal from '@/components/teleconsultation/EmergencyConfirmationModal';

interface Doctor {
  id: string;
  firstName?: string;
  lastName?: string;
  specialty?: string;
  practicePhone?: string;
  role?: string; // 'MEDECIN' | 'CARDIOLOGUE'
}

interface CooldownStatus {
  allowed: boolean;
  reason?: string;
  cooldownEndsAt?: string;
}

interface EmergencyEvent {
  id: string;
  status: string;
  triggerType: string;
  triggerValue: any;
  createdAt: string;
  acknowledgedAt?: string;
}

export default function UrgencesPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [cooldowns, setCooldowns] = useState<Record<string, CooldownStatus>>({});
  const [cooldownTimers, setCooldownTimers] = useState<Record<string, string>>({});

  const fetchCooldowns = useCallback(async (doctorList: Doctor[]) => {
    const results: Record<string, CooldownStatus> = {};
    for (const doc of doctorList) {
      try {
        const r = await api.get(`/emergency-calls/cooldown?doctorId=${doc.id}`);
        results[doc.id] = r.data;
      } catch {
        results[doc.id] = { allowed: true };
      }
    }
    setCooldowns(results);
  }, []);

  useEffect(() => {
    Promise.all([
      api.get('/patients/my-doctors').then(r => r.data).catch(() => []),
      api.get('/emergency-calls/patient').then(r => r.data).catch(() => []),
    ]).then(([docs, emergList]) => {
      const doctorList = (Array.isArray(docs) ? docs : []).map((d: any) => ({
        id: d.doctor?.id || d.doctorId || d.id,
        firstName: d.doctor?.firstName || d.firstName,
        lastName: d.doctor?.lastName || d.lastName,
        specialty: d.doctor?.specialty || d.specialty,
        practicePhone: d.doctor?.practicePhone || d.practicePhone,
        role: d.doctor?.role || d.role,
      }));
      setDoctors(doctorList);
      setEmergencies(Array.isArray(emergList) ? emergList : []);
      fetchCooldowns(doctorList);
    }).finally(() => setLoading(false));
  }, [fetchCooldowns]);

  // Update cooldown timers every second
  useEffect(() => {
    const interval = setInterval(() => {
      const timers: Record<string, string> = {};
      for (const [docId, cd] of Object.entries(cooldowns)) {
        if (!cd.allowed && cd.cooldownEndsAt) {
          const remaining = new Date(cd.cooldownEndsAt).getTime() - Date.now();
          if (remaining > 0) {
            const min = Math.floor(remaining / 60_000);
            const sec = Math.floor((remaining % 60_000) / 1000);
            timers[docId] = `${min}:${sec.toString().padStart(2, '0')}`;
          } else {
            // Cooldown expired, refresh
            fetchCooldowns(doctors);
          }
        }
      }
      setCooldownTimers(timers);
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldowns, doctors, fetchCooldowns]);

  const handleEmergencyClick = (doctor: Doctor) => {
    const cd = cooldowns[doctor.id];
    if (cd && !cd.allowed) {
      setErrorMessage(cd.reason || 'Veuillez patienter avant de relancer un appel.');
      setSuccessMessage('');
      return;
    }
    setSelectedDoctor(doctor);
    setShowModal(true);
    setSuccessMessage('');
    setErrorMessage('');
  };

  const handleConfirm = async (emergencyType: 'free' | 'paid') => {
    setShowModal(false);
    if (!selectedDoctor) return;
    setTriggerLoading(true);
    setErrorMessage('');
    try {
      await api.post('/emergency-calls/trigger', {
        doctorId: selectedDoctor.id,
        emergencyType,
      });
      setSuccessMessage(
        `Appel d'urgence ${emergencyType === 'paid' ? 'payant' : 'gratuit'} envoye a Dr. ${selectedDoctor.firstName || ''} ${selectedDoctor.lastName || ''}. Veuillez patienter.`
      );
      // Refresh emergencies and cooldowns
      api.get('/emergency-calls/patient').then(r => setEmergencies(r.data || [])).catch(() => {});
      fetchCooldowns(doctors);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Erreur lors de l\'envoi de l\'appel d\'urgence.');
    } finally {
      setTriggerLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      ACTIVE: { label: 'En cours', color: 'bg-red-500/15 text-red-400 animate-pulse' },
      ACKNOWLEDGED: { label: 'Accepte', color: 'bg-green-500/15 text-green-400' },
      RESOLVED: { label: 'Expire', color: 'bg-cardio-800 text-slate-400' },
      FALSE_POSITIVE: { label: 'Faux positif', color: 'bg-amber-500/15 text-amber-400' },
    };
    const s = map[status] || { label: status, color: 'bg-cardio-800 text-slate-400' };
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.color}`}>{s.label}</span>;
  };

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

      {/* Success / Error messages */}
      {successMessage && (
        <div className="glass-card border border-green-500/20 rounded-xl p-4 mb-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-green-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-green-300">{successMessage}</p>
        </div>
      )}
      {errorMessage && (
        <div className="glass-card border border-red-500/20 rounded-xl p-4 mb-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-red-300">{errorMessage}</p>
        </div>
      )}

      {/* Trigger emergency section */}
      <div className="glass-card rounded-xl p-4 sm:p-6 mb-6">
        <h2 className="text-lg font-semibold mb-1">Contacter un praticien en urgence</h2>
        <p className="text-sm text-slate-400 mb-4">
          Selectionnez votre praticien pour lancer un appel d&apos;urgence. Il sera notifie immediatement.
        </p>

        {doctors.length === 0 ? (
          <div className="text-center py-6 text-slate-500">
            <p className="text-sm">Aucun praticien associe.</p>
            <p className="text-xs mt-1">Associez-vous a un praticien depuis votre tableau de bord.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {doctors.map(doc => {
              const cd = cooldowns[doc.id];
              const isBlocked = cd && !cd.allowed;
              const timer = cooldownTimers[doc.id];

              return (
                <div key={doc.id} className={`glass-card border rounded-xl p-4 ${isBlocked ? 'border-amber-500/20 opacity-70' : 'border-cyan-500/10'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        Dr. {doc.firstName || ''} {doc.lastName || ''}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{doc.specialty || getDoctorLabel(doc.role)}</p>
                    </div>
                    {isBlocked ? (
                      <div className="shrink-0 text-right">
                        <div className="bg-amber-900/30 border border-amber-500/20 text-amber-400 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {timer || 'Cooldown'}
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEmergencyClick(doc)}
                        disabled={triggerLoading}
                        className="shrink-0 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                        URGENCE
                      </button>
                    )}
                  </div>
                  {isBlocked && cd?.reason && (
                    <p className="text-xs text-amber-400/80 mt-2">{cd.reason}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Emergency history */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="px-4 sm:px-6 py-3 bg-cardio-800 border-b border-cyan-500/10">
          <h3 className="font-semibold text-sm">Historique des urgences</h3>
        </div>
        {emergencies.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            Aucun appel d&apos;urgence
          </div>
        ) : (
          <div className="divide-y divide-cyan-500/10">
            {emergencies.map(e => {
              const data = e.triggerValue || {};
              return (
                <div key={e.id} className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      Appel d&apos;urgence {data.emergencyType === 'paid' ? 'payant' : 'gratuit'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(e.createdAt).toLocaleString('fr-FR')}
                    </p>
                  </div>
                  {statusBadge(e.status)}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Emergency confirmation modal */}
      {showModal && (
        <EmergencyConfirmationModal
          onConfirm={handleConfirm}
          onCancel={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
