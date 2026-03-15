'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/query-client';
import { usePatientUpdates } from '@/hooks/usePatientUpdates';
import { usePatientChartData } from '@/hooks/useAnalytics';
import ChartWrapper from '@/components/charts/ChartWrapper';
import BpLineChart from '@/components/charts/BpLineChart';
import ScheduleForm from '@/components/teleconsultation/ScheduleForm';

export default function DoctorPatientDetailPage() {
  const params = useParams();
  const patientId = params.id as string;
  const queryClient = useQueryClient();

  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState('GENERAL');

  // Auto-refresh when this patient updates their profile (real-time WebSocket)
  usePatientUpdates(patientId);
  const [aiDays, setAiDays] = useState(30);
  const [showScheduleTc, setShowScheduleTc] = useState(false);

  // Queries
  const { data: patient, isLoading: loadingPatient } = useQuery({
    queryKey: queryKeys.doctor.patient(patientId),
    queryFn: async () => {
      const { data } = await api.get(`/patients/${patientId}`);
      return data;
    },
    enabled: !!patientId,
  });

  const { data: measurements = [] } = useQuery({
    queryKey: ['measurements', 'patient', patientId],
    queryFn: async () => {
      const { data } = await api.get(`/measurements/patient/${patientId}?days=90&limit=50`);
      return data.data || data || [];
    },
    enabled: !!patientId,
  });

  const { data: analysis, refetch: refetchAnalysis } = useQuery({
    queryKey: ['ai', 'patient', patientId, 'latest'],
    queryFn: async () => {
      const { data } = await api.get(`/ai/patient/${patientId}/history?limit=1`);
      const aiData = data.data || data;
      return Array.isArray(aiData) ? aiData[0] || null : aiData;
    },
    enabled: !!patientId,
  });

  const { data: chartData = [] } = usePatientChartData(patientId, 30);

  const { data: notes = [] } = useQuery({
    queryKey: ['doctor', 'notes', patientId],
    queryFn: async () => {
      const { data } = await api.get(`/doctors/patients/${patientId}/notes`);
      return data.data || data || [];
    },
    enabled: !!patientId,
  });

  // Mutations
  const addNoteMutation = useMutation({
    mutationFn: async ({ text, type }: { text: string; type: string }) => {
      const { data } = await api.post(`/doctors/patients/${patientId}/notes`, { text, type });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor', 'notes', patientId] });
      setNewNote('');
    },
  });

  const aiAnalysisMutation = useMutation({
    mutationFn: async (days: number) => {
      const { data } = await api.post(`/ai/patient/${patientId}/analyze`, { days });
      return data;
    },
    onSuccess: () => {
      refetchAnalysis();
    },
  });

  const riskBadge = (level: string) => {
    const colors: Record<string, string> = {
      FAIBLE: 'bg-green-500/15 text-green-400',
      MODERE: 'bg-amber-500/15 text-amber-400',
      ELEVE: 'bg-red-500/15 text-red-400',
      CRITIQUE: 'bg-red-500/20 text-red-300',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[level] || 'bg-cardio-800'}`}>
        {level}
      </span>
    );
  };

  if (loadingPatient) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">Chargement du dossier patient...</p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400 mb-4">Patient introuvable</p>
        <Link href="/doctor/patients" className="text-cyan-400 hover:text-cyan-300 text-sm">
          Retour a la liste
        </Link>
      </div>
    );
  }

  const last10 = measurements.slice(0, 10);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Link href="/doctor/patients" className="text-cyan-400 hover:text-cyan-300 text-sm">
            &larr; Retour
          </Link>
          <h1 className="text-lg sm:text-2xl font-bold">
            {patient.firstName} {patient.lastName}
          </h1>
        </div>
        <button
          onClick={() => setShowScheduleTc(!showScheduleTc)}
          className="glow-btn px-4 py-2 rounded-lg transition text-sm flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {showScheduleTc ? 'Fermer' : 'Planifier teleconsultation'}
        </button>
      </div>

      {showScheduleTc && (
        <ScheduleForm
          preselectedPatientId={patientId}
          onSuccess={() => setShowScheduleTc(false)}
          onCancel={() => setShowScheduleTc(false)}
        />
      )}

      {/* Patient info card */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="glass-card p-4 rounded-xl">
          <p className="text-xs text-slate-400">Nom complet</p>
          <p className="font-semibold">{patient.firstName} {patient.lastName}</p>
        </div>
        <div className="glass-card p-4 rounded-xl">
          <p className="text-xs text-slate-400">Age</p>
          <p className="font-semibold">{patient.age ? `${patient.age} ans` : '--'}</p>
        </div>
        <div className="glass-card p-4 rounded-xl">
          <p className="text-xs text-slate-400">Statut medical</p>
          <p className="font-semibold">{patient.medicalStatus || '--'}</p>
        </div>
        <div className="glass-card p-4 rounded-xl">
          <p className="text-xs text-slate-400">IMC</p>
          <p className="font-semibold">{patient.bmi ? patient.bmi.toFixed(1) : '--'}</p>
        </div>
      </div>

      {/* BP Chart */}
      {chartData.length >= 2 && (
        <div className="mb-6">
          <ChartWrapper
            title="Evolution de la tension arterielle"
            subtitle="30 derniers jours — Systolique et diastolique"
            height="h-64"
          >
            <BpLineChart measurements={chartData} showPulse showZones />
          </ChartWrapper>
        </div>
      )}

      {/* AI Analysis */}
      <div className="glass-card p-6 rounded-xl mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Analyse T-Cardio</h2>
          <div className="flex items-center gap-3">
            <select
              value={aiDays}
              onChange={(e) => setAiDays(Number(e.target.value))}
              className="glass-input rounded-lg px-3 py-1.5 text-sm"
            >
              <option value={7}>7 jours</option>
              <option value={14}>14 jours</option>
              <option value={30}>30 jours</option>
              <option value={90}>90 jours</option>
            </select>
            <button
              onClick={() => aiAnalysisMutation.mutate(aiDays)}
              disabled={aiAnalysisMutation.isPending}
              className="glow-btn px-4 py-1.5 rounded-lg disabled:opacity-50 transition text-sm"
            >
              {aiAnalysisMutation.isPending ? 'Analyse en cours...' : 'Lancer l\'analyse'}
            </button>
          </div>
        </div>
        {analysis ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Risque:</span>
              {riskBadge(analysis.riskLevel)}
              {analysis.confidenceScore && (
                <span className="text-xs text-slate-500">
                  (Confiance: {Math.round(analysis.confidenceScore * 100)}%)
                </span>
              )}
            </div>
            {analysis.doctorSummary && (
              <div>
                <p className="text-sm font-medium mb-1">Resume medecin:</p>
                <p className="text-sm text-slate-300 whitespace-pre-line">{analysis.doctorSummary}</p>
              </div>
            )}
            {analysis.patientSummary && (
              <div>
                <p className="text-sm font-medium mb-1">Resume patient:</p>
                <p className="text-sm text-slate-300 whitespace-pre-line">{analysis.patientSummary}</p>
              </div>
            )}
            <p className="text-xs text-slate-500">
              Analyse du {new Date(analysis.createdAt).toLocaleString('fr-FR')}
            </p>
          </div>
        ) : (
          <p className="text-slate-500 text-sm">Aucune analyse disponible pour ce patient</p>
        )}
      </div>

      {/* Measurements table (last 10) */}
      <div className="glass-card rounded-xl overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-cyan-500/10">
          <h2 className="text-lg font-semibold">Dernieres mesures</h2>
        </div>
        {last10.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">Aucune mesure enregistree</div>
        ) : (
          <table className="w-full">
            <thead className="bg-cardio-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Systolique</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Diastolique</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Pouls</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Risque</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyan-500/10">
              {last10.map((m: any, i: number) => (
                <tr key={m.id || i} className={m.isEmergency ? 'bg-red-500/10' : ''}>
                  <td className="px-4 py-3 text-sm">
                    {new Date(m.measuredAt).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">{m.systolic}</td>
                  <td className="px-4 py-3 text-sm font-medium">{m.diastolic}</td>
                  <td className="px-4 py-3 text-sm">{m.pulse || '-'}</td>
                  <td className="px-4 py-3">
                    {m.riskLevel ? riskBadge(m.riskLevel) : (
                      <span className="text-xs text-slate-500">--</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Medical notes */}
      <div className="glass-card p-6 rounded-xl">
        <h2 className="text-lg font-semibold mb-4">Notes medicales</h2>

        <div className="mb-6 space-y-3">
          <div className="flex gap-3">
            <select
              value={noteType}
              onChange={(e) => setNoteType(e.target.value)}
              className="glass-input rounded-lg px-3 py-2 text-sm"
            >
              <option value="GENERAL">General</option>
              <option value="DIAGNOSTIC">Diagnostic</option>
              <option value="PRESCRIPTION">Prescription</option>
              <option value="SUIVI">Suivi</option>
            </select>
          </div>
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Ajouter une note medicale..."
            rows={3}
            className="w-full glass-input rounded-lg px-4 py-2 text-sm resize-none"
          />
          <button
            onClick={() => addNoteMutation.mutate({ text: newNote.trim(), type: noteType })}
            disabled={addNoteMutation.isPending || !newNote.trim()}
            className="glow-btn px-4 py-2 rounded-lg disabled:opacity-50 transition text-sm"
          >
            {addNoteMutation.isPending ? 'Enregistrement...' : 'Ajouter la note'}
          </button>
        </div>

        <div className="space-y-3">
          {notes.length === 0 ? (
            <p className="text-slate-500 text-sm">Aucune note pour ce patient</p>
          ) : (
            notes.map((note: any, i: number) => (
              <div key={note.id || i} className="border border-cyan-500/10 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-cyan-500/10 text-cyan-400">
                    {note.type}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(note.createdAt).toLocaleString('fr-FR')}
                  </span>
                </div>
                <p className="text-sm text-slate-300 whitespace-pre-line">{note.text}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
