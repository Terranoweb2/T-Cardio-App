'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Pill, Download, Plus, Loader2, X, FileText, Eye, RefreshCw } from 'lucide-react';

interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes?: string;
}

interface Prescription {
  id: string;
  medications: Medication[];
  notes: string | null;
  pdfUrl: string | null;
  signedBy: string | null;
  signedAt: string | null;
  createdAt: string;
  patient?: { firstName: string; lastName: string };
  doctor?: { firstName: string; lastName: string; specialty: string };
}

interface PatientOption {
  id: string;
  firstName: string | null;
  lastName: string | null;
}

export default function PrescriptionsPage() {
  const { user } = useAuthStore();
  const isDoctor = user?.role === 'MEDECIN' || user?.role === 'CARDIOLOGUE' || user?.role === 'ADMIN';
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [viewingPdf, setViewingPdf] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  // Form state
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [medications, setMedications] = useState<Medication[]>([{ name: '', dosage: '', frequency: '', duration: '' }]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadPrescriptions();
    if (isDoctor) loadPatients();
  }, []);

  const loadPrescriptions = async () => {
    try {
      const endpoint = isDoctor ? '/prescriptions/doctor' : '/prescriptions/patient';
      const res = await api.get(endpoint);
      setPrescriptions(res.data);
    } catch (err) {
      console.error('Failed to load prescriptions', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPatients = async () => {
    try {
      const res = await api.get('/doctors/patients');
      setPatients(res.data?.patients || res.data || []);
    } catch (err) {
      console.error('Failed to load patients', err);
    }
  };

  const addMedication = () => {
    setMedications([...medications, { name: '', dosage: '', frequency: '', duration: '' }]);
  };

  const removeMedication = (index: number) => {
    if (medications.length > 1) {
      setMedications(medications.filter((_, i) => i !== index));
    }
  };

  const updateMedication = (index: number, field: keyof Medication, value: string) => {
    const updated = [...medications];
    updated[index] = { ...updated[index], [field]: value };
    setMedications(updated);
  };

  const handleSubmit = async () => {
    if (!selectedPatientId) {
      setFormError('Veuillez selectionner un patient.');
      return;
    }
    if (medications.some((m) => !m.name || !m.dosage)) {
      setFormError('Veuillez remplir le nom et la posologie de chaque medicament.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    setFormSuccess(null);
    try {
      await api.post('/prescriptions', {
        patientId: selectedPatientId,
        medications: medications.filter((m) => m.name),
        notes: notes || undefined,
      });
      setShowForm(false);
      setMedications([{ name: '', dosage: '', frequency: '', duration: '' }]);
      setNotes('');
      setSelectedPatientId('');
      setFormSuccess('Ordonnance creee et envoyee au patient avec succes !');
      setTimeout(() => setFormSuccess(null), 5000);
      loadPrescriptions();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erreur lors de la creation de l\'ordonnance';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const isMobile = () => {
    if (typeof navigator === 'undefined') return false;
    return /Android|iPhone|iPad|iPod|TCardioApp/i.test(navigator.userAgent) ||
      (window.innerWidth < 768);
  };

  const viewPdf = async (id: string) => {
    // On mobile/WebView, directly download since iframe PDF rendering doesn't work
    if (isMobile()) {
      downloadPdf(id);
      return;
    }
    setPdfLoading(true);
    setPdfError(null);
    setViewingPdf(id);
    try {
      const res = await api.get(`/prescriptions/${id}/download`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      if (blob.size < 100) {
        setPdfError('Le PDF semble vide ou corrompu.');
        setPdfLoading(false);
        return;
      }
      const url = window.URL.createObjectURL(blob);
      setPdfBlobUrl(url);
    } catch (err) {
      console.error('Failed to load PDF', err);
      setPdfError('Impossible de charger le PDF. Veuillez reessayer.');
    } finally {
      setPdfLoading(false);
    }
  };

  const closePdfViewer = () => {
    if (pdfBlobUrl) {
      window.URL.revokeObjectURL(pdfBlobUrl);
    }
    setViewingPdf(null);
    setPdfBlobUrl(null);
    setPdfError(null);
  };

  const downloadPdf = async (id: string) => {
    try {
      const res = await api.get(`/prescriptions/${id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ordonnance-${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to download PDF', err);
    }
  };

  const regeneratePdf = async (id: string) => {
    setRegeneratingId(id);
    try {
      await api.post(`/prescriptions/${id}/regenerate-pdf`);
      setFormSuccess('PDF regenere avec succes !');
      setTimeout(() => setFormSuccess(null), 5000);
      loadPrescriptions();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Erreur lors de la regeneration du PDF';
      setFormError(msg);
      setTimeout(() => setFormError(null), 5000);
    } finally {
      setRegeneratingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gradient-cyan">Ordonnances</h1>
        {isDoctor && (
          <button onClick={() => setShowForm(true)} className="glow-btn rounded-lg px-4 py-2 text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nouvelle ordonnance
          </button>
        )}
      </div>

      {/* Success / Error feedback */}
      {formSuccess && (
        <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
          {formSuccess}
        </div>
      )}
      {formError && !showForm && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {formError}
        </div>
      )}

      {/* PDF Viewer modal */}
      {viewingPdf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="glass-card rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                Ordonnance
              </h2>
              <div className="flex items-center gap-2">
                {pdfBlobUrl && (
                  <button
                    onClick={() => downloadPdf(viewingPdf)}
                    className="p-2 rounded-lg hover:bg-cyan-500/10 transition text-cyan-400"
                    title="Telecharger"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                )}
                <button onClick={closePdfViewer} className="p-2 hover:text-red-400 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              {pdfLoading && (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                </div>
              )}
              {pdfError && (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <FileText className="w-12 h-12 text-red-400/40" />
                  <p className="text-red-400 text-sm">{pdfError}</p>
                  <button
                    onClick={closePdfViewer}
                    className="text-sm text-slate-400 hover:text-white transition"
                  >
                    Fermer
                  </button>
                </div>
              )}
              {pdfBlobUrl && !pdfLoading && !pdfError && (
                <iframe
                  src={pdfBlobUrl}
                  className="w-full h-full border-0"
                  title="Ordonnance PDF"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Doctor form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto dark-scrollbar">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-200">Nouvelle ordonnance</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:text-red-400 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Patient selector */}
            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-1">Patient</label>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="w-full glass-input rounded-lg px-3 py-2.5 text-sm"
              >
                <option value="">Selectionner un patient...</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {[p.firstName, p.lastName].filter(Boolean).join(' ') || 'Patient'}
                  </option>
                ))}
              </select>
            </div>

            {/* Medications */}
            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-2">Medicaments</label>
              {medications.map((med, idx) => (
                <div key={idx} className="glass-card rounded-lg p-3 mb-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-cyan-400 font-semibold">Medicament {idx + 1}</span>
                    {medications.length > 1 && (
                      <button onClick={() => removeMedication(idx)} className="text-red-400 hover:text-red-300">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      placeholder="Nom du medicament"
                      value={med.name}
                      onChange={(e) => updateMedication(idx, 'name', e.target.value)}
                      className="glass-input rounded-lg px-3 py-2 text-sm col-span-2"
                    />
                    <input
                      placeholder="Posologie (ex: 10mg)"
                      value={med.dosage}
                      onChange={(e) => updateMedication(idx, 'dosage', e.target.value)}
                      className="glass-input rounded-lg px-3 py-2 text-sm"
                    />
                    <input
                      placeholder="Frequence (ex: 2x/jour)"
                      value={med.frequency}
                      onChange={(e) => updateMedication(idx, 'frequency', e.target.value)}
                      className="glass-input rounded-lg px-3 py-2 text-sm"
                    />
                    <input
                      placeholder="Duree (ex: 30 jours)"
                      value={med.duration}
                      onChange={(e) => updateMedication(idx, 'duration', e.target.value)}
                      className="glass-input rounded-lg px-3 py-2 text-sm col-span-2"
                    />
                  </div>
                </div>
              ))}
              <button onClick={addMedication} className="text-sm text-cyan-400 hover:text-cyan-300 transition mt-1">
                + Ajouter un medicament
              </button>
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label className="block text-sm text-slate-400 mb-1">Notes (optionnel)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full glass-input rounded-lg px-3 py-2.5 text-sm resize-none"
                placeholder="Instructions particulieres..."
              />
            </div>

            {formError && (
              <div className="mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {formError}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!selectedPatientId || medications.some((m) => !m.name || !m.dosage) || submitting}
              className="w-full glow-btn rounded-lg py-3 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Generer l&apos;ordonnance
            </button>
          </div>
        </div>
      )}

      {/* Prescriptions list */}
      {prescriptions.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center">
          <Pill className="w-12 h-12 text-cyan-500/20 mx-auto mb-3" />
          <p className="text-slate-400">Aucune ordonnance</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {prescriptions.map((rx) => (
            <div key={rx.id} className="glass-card-hover rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Pill className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm font-semibold text-slate-200">
                      {isDoctor && rx.patient
                        ? `${rx.patient.firstName} ${rx.patient.lastName}`
                        : rx.doctor
                        ? `Dr. ${rx.doctor.firstName} ${rx.doctor.lastName}`
                        : 'Ordonnance'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {(rx.medications as Medication[]).map((med, i) => (
                      <span key={i} className="text-xs bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded-full border border-cyan-500/20">
                        {med.name} - {med.dosage}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">
                    {new Date(rx.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    {rx.signedBy && ` — Signe par ${rx.signedBy}`}
                  </p>
                </div>
                {rx.pdfUrl ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => viewPdf(rx.id)}
                      className="p-2 rounded-lg hover:bg-cyan-500/10 transition text-cyan-400"
                      title="Voir l'ordonnance"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => downloadPdf(rx.id)}
                      className="p-2 rounded-lg hover:bg-cyan-500/10 transition text-cyan-400"
                      title="Telecharger le PDF"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                ) : isDoctor ? (
                  <button
                    onClick={() => regeneratePdf(rx.id)}
                    disabled={regeneratingId === rx.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition disabled:opacity-50"
                    title="Regenerer le PDF"
                  >
                    {regeneratingId === rx.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    {regeneratingId === rx.id ? 'Generation...' : 'Regenerer PDF'}
                  </button>
                ) : (
                  <span className="text-xs text-slate-500 italic px-2">PDF indisponible</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
