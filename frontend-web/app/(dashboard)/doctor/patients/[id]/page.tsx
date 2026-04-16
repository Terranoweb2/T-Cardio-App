'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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

// ---- Speech-to-Text hook ----
function useSpeechToText(onResult: (text: string) => void) {
  const recognitionRef = useRef<any>(null);
  const [isListening, setIsListening] = useState(false);

  const toggle = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('La reconnaissance vocale n\'est pas supportee par votre navigateur.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript;
        }
      }
      if (transcript) onResult(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, onResult]);

  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  return { isListening, toggle };
}

// ---- Mic button component ----
function MicButton({ isListening, onClick }: { isListening: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={isListening ? 'Arreter la dictee' : 'Dicter (micro)'}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border transition ${
        isListening
          ? 'bg-red-500/20 border-red-500/40 text-red-400 animate-pulse'
          : 'glass-input border-cyan-500/15 text-slate-400 hover:text-cyan-400'
      }`}
    >
      {isListening ? (
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
        </span>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-14 0m7 7v4m-4 0h8m-4-12a3 3 0 00-3 3v4a3 3 0 006 0v-4a3 3 0 00-3-3z" />
        </svg>
      )}
    </button>
  );
}

// ---- BP Photo card (fetches image via authenticated API) ----
function BpPhotoCard({ measurementId, date, systolic, diastolic, onClick }: {
  measurementId: string;
  date: string;
  systolic: number;
  diastolic: number;
  onClick: (url: string) => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadImage = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
        const res = await fetch(`${baseURL}/measurements/${measurementId}/photo`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Not found');
        const blob = await res.blob();
        if (!cancelled) setBlobUrl(URL.createObjectURL(blob));
      } catch {
        if (!cancelled) setError(true);
      }
    };
    loadImage();
    return () => { cancelled = true; };
  }, [measurementId]);

  if (error) {
    return (
      <div className="aspect-square rounded-lg bg-cardio-800 border border-cyan-500/10 flex flex-col items-center justify-center p-2">
        <svg className="w-8 h-8 text-slate-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-[10px] text-slate-500 text-center">{systolic}/{diastolic}</p>
        <p className="text-[10px] text-slate-600">{new Date(date).toLocaleDateString('fr-FR')}</p>
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div className="aspect-square rounded-lg bg-cardio-800 border border-cyan-500/10 flex items-center justify-center animate-pulse">
        <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className="relative aspect-square rounded-lg overflow-hidden border border-cyan-500/10 cursor-pointer group"
      onClick={() => onClick(blobUrl)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={blobUrl} alt={`Mesure ${systolic}/${diastolic}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        <p className="text-xs font-medium text-white">{systolic}/{diastolic} mmHg</p>
        <p className="text-[10px] text-slate-300">{new Date(date).toLocaleDateString('fr-FR')}</p>
      </div>
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
        <svg className="w-8 h-8 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
        </svg>
      </div>
    </div>
  );
}

// ---- Teleconsultation image card (fetches via authenticated endpoint) ----
function TcImageCard({ url, date, fileName, onClick }: {
  url: string;
  date: string;
  fileName: string;
  onClick: (url: string) => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadImage = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Not found');
        const blob = await res.blob();
        if (!cancelled) setBlobUrl(URL.createObjectURL(blob));
      } catch {
        if (!cancelled) setError(true);
      }
    };
    loadImage();
    return () => { cancelled = true; };
  }, [url]);

  if (error) {
    return (
      <div className="aspect-square rounded-lg bg-cardio-800 border border-cyan-500/10 flex flex-col items-center justify-center p-2">
        <svg className="w-8 h-8 text-slate-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-[10px] text-slate-500 text-center truncate w-full">{fileName}</p>
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div className="aspect-square rounded-lg bg-cardio-800 border border-cyan-500/10 flex items-center justify-center animate-pulse">
        <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className="relative aspect-square rounded-lg overflow-hidden border border-cyan-500/10 cursor-pointer group"
      onClick={() => onClick(blobUrl)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={blobUrl} alt={fileName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        <p className="text-xs text-white truncate">{fileName}</p>
        <p className="text-[10px] text-slate-300">{new Date(date).toLocaleDateString('fr-FR')}</p>
      </div>
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
        <svg className="w-8 h-8 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
        </svg>
      </div>
    </div>
  );
}

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

  // Editable doctor summary
  const [editingSummary, setEditingSummary] = useState(false);
  const [editedSummary, setEditedSummary] = useState('');

  // Prescription PDF viewer
  const [viewingRxPdf, setViewingRxPdf] = useState<string | null>(null);
  const [rxPdfBlobUrl, setRxPdfBlobUrl] = useState<string | null>(null);
  const [rxPdfLoading, setRxPdfLoading] = useState(false);
  const [rxPdfError, setRxPdfError] = useState<string | null>(null);

  // Image lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Speech-to-text for medical notes
  const noteSpeech = useSpeechToText(useCallback((text: string) => {
    setNewNote((prev) => (prev ? prev + ' ' : '') + text);
  }, []));

  // Speech-to-text for doctor summary editing
  const summarySpeech = useSpeechToText(useCallback((text: string) => {
    setEditedSummary((prev) => (prev ? prev + ' ' : '') + text);
  }, []));

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

  // Prescriptions for this patient (fetch doctor's prescriptions, filter by patientId)
  const { data: prescriptions = [] } = useQuery({
    queryKey: ['prescriptions', 'patient', patientId],
    queryFn: async () => {
      const { data } = await api.get('/prescriptions/doctor');
      const all = Array.isArray(data) ? data : data.data || [];
      return all.filter((rx: any) => rx.patientId === patientId);
    },
    enabled: !!patientId,
  });

  // Reports for this patient
  const { data: reports = [] } = useQuery({
    queryKey: ['reports', 'patient', patientId],
    queryFn: async () => {
      const { data } = await api.get(`/reports/patient/${patientId}`);
      return Array.isArray(data) ? data : data.data || [];
    },
    enabled: !!patientId,
  });

  // Teleconsultation images: fetch doctor teleconsultations, filter by patient, then fetch messages with files
  const { data: tcImages = [] } = useQuery({
    queryKey: ['tc-images', 'patient', patientId],
    queryFn: async () => {
      // Get all doctor teleconsultations
      const { data: tcs } = await api.get('/teleconsultations/doctor');
      const allTcs = Array.isArray(tcs) ? tcs : tcs.data || [];
      const patientTcs = allTcs.filter((tc: any) => tc.patientId === patientId);

      // For each teleconsultation, fetch messages and collect image files
      const images: Array<{ url: string; date: string; tcId: string; fileName: string }> = [];
      for (const tc of patientTcs) {
        try {
          const { data: msgs } = await api.get(`/teleconsultations/${tc.id}/messages`);
          const msgList = Array.isArray(msgs) ? msgs : msgs.data || [];
          for (const msg of msgList) {
            if (msg.fileUrl && msg.fileType && msg.fileType.startsWith('image/')) {
              const filename = msg.fileUrl.split('/').pop() || msg.fileName || 'image';
              images.push({
                url: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/teleconsultations/${tc.id}/files/${filename}`,
                date: msg.createdAt,
                tcId: tc.id,
                fileName: msg.fileName || filename,
              });
            }
          }
        } catch {
          // Teleconsultation messages may fail if access is restricted
        }
      }
      return images;
    },
    enabled: !!patientId,
  });

  // Build gallery of BP measurement photos from already-loaded measurements
  const measurementPhotos = useMemo(() => {
    return measurements
      .filter((m: any) => m.photoPath)
      .map((m: any) => ({
        date: m.measuredAt,
        systolic: m.systolic,
        diastolic: m.diastolic,
        id: m.id,
      }));
  }, [measurements]);

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

  const updateSummaryMutation = useMutation({
    mutationFn: async ({ analysisId, doctorSummary }: { analysisId: string; doctorSummary: string }) => {
      const { data } = await api.patch(`/ai/analysis/${analysisId}/summary`, { doctorSummary });
      return data;
    },
    onSuccess: () => {
      refetchAnalysis();
      setEditingSummary(false);
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

  // ---- Prescription PDF helpers ----
  const viewRxPdf = async (id: string) => {
    setRxPdfLoading(true);
    setRxPdfError(null);
    setViewingRxPdf(id);
    try {
      const res = await api.get(`/prescriptions/${id}/download`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      if (blob.size < 100) {
        setRxPdfError('Le PDF semble vide ou corrompu.');
        setRxPdfLoading(false);
        return;
      }
      const url = window.URL.createObjectURL(blob);
      setRxPdfBlobUrl(url);
    } catch {
      setRxPdfError('Impossible de charger le PDF.');
    } finally {
      setRxPdfLoading(false);
    }
  };

  const closeRxPdfViewer = () => {
    if (rxPdfBlobUrl) window.URL.revokeObjectURL(rxPdfBlobUrl);
    setViewingRxPdf(null);
    setRxPdfBlobUrl(null);
    setRxPdfError(null);
  };

  const downloadRxPdf = async (id: string) => {
    try {
      const res = await api.get(`/prescriptions/${id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ordonnance-${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // silent fail
    }
  };

  // ---- Report download helper ----
  const downloadReport = async (reportId: string) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
      const response = await fetch(`${baseURL}/reports/${reportId}/download?token=${token}`);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `rapport-${reportId}.pdf`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => document.body.removeChild(link), 2000);
      };
      reader.readAsDataURL(blob);
    } catch {
      // Fallback: open URL directly
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
      window.open(`${baseURL}/reports/${reportId}/download?token=${token}`, '_blank');
    }
  };

  // ---- Lightbox helper for images ----
  const openLightbox = (url: string) => setLightboxUrl(url);
  const closeLightbox = () => setLightboxUrl(null);

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

            {/* Synthese Cardiologue - editable */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium">Synthese Cardiologue :</p>
                {!editingSummary && (
                  <button
                    onClick={() => { setEditedSummary(analysis.doctorSummary || ''); setEditingSummary(true); }}
                    className="text-xs text-cyan-400 hover:text-cyan-300 transition"
                  >
                    Modifier
                  </button>
                )}
              </div>
              {editingSummary ? (
                <div className="space-y-2">
                  <div className="flex gap-2 items-start">
                    <textarea
                      value={editedSummary}
                      onChange={(e) => setEditedSummary(e.target.value)}
                      rows={4}
                      className="flex-1 glass-input rounded-lg px-3 py-2 text-sm resize-none"
                    />
                    <MicButton isListening={summarySpeech.isListening} onClick={summarySpeech.toggle} />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateSummaryMutation.mutate({ analysisId: analysis.id, doctorSummary: editedSummary.trim() })}
                      disabled={updateSummaryMutation.isPending}
                      className="glow-btn px-3 py-1.5 rounded-lg disabled:opacity-50 transition text-xs"
                    >
                      {updateSummaryMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                    <button
                      onClick={() => { setEditingSummary(false); summarySpeech.isListening && summarySpeech.toggle(); }}
                      className="text-slate-400 hover:text-slate-300 px-3 py-1.5 text-xs transition"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-300 whitespace-pre-line">
                  {analysis.doctorSummary || <span className="text-slate-500 italic">Aucune synthese. Cliquez sur Modifier pour en rediger une.</span>}
                </p>
              )}
            </div>

            {/* Resume patient (read-only) */}
            {analysis.patientSummary && (
              <div>
                <p className="text-sm font-medium mb-1">Synthese Patient :</p>
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

      {/* ==================== PRESCRIPTIONS ==================== */}
      <div className="glass-card p-6 rounded-xl mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Ordonnances</h2>
          <Link
            href="/prescriptions"
            className="glow-btn px-4 py-1.5 rounded-lg transition text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Creer ordonnance
          </Link>
        </div>
        {prescriptions.length === 0 ? (
          <p className="text-slate-500 text-sm">Aucune ordonnance pour ce patient</p>
        ) : (
          <div className="space-y-3">
            {prescriptions.map((rx: any) => (
              <div key={rx.id} className="border border-cyan-500/10 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-2 mb-2">
                      {Array.isArray(rx.medications) && rx.medications.map((med: any, i: number) => (
                        <span key={i} className="text-xs bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded-full border border-cyan-500/20">
                          {med.name}{med.dosage ? ` - ${med.dosage}` : ''}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500">
                      {new Date(rx.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {rx.signedBy && ` — Signe par ${rx.signedBy}`}
                    </p>
                  </div>
                  {rx.pdfUrl && (
                    <div className="flex items-center gap-1 ml-3 shrink-0">
                      <button
                        onClick={() => viewRxPdf(rx.id)}
                        className="p-2 rounded-lg hover:bg-cyan-500/10 transition text-cyan-400"
                        title="Voir le PDF"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => downloadRxPdf(rx.id)}
                        className="p-2 rounded-lg hover:bg-cyan-500/10 transition text-cyan-400"
                        title="Telecharger le PDF"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Prescription PDF Viewer Modal */}
      {viewingRxPdf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="glass-card rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Ordonnance
              </h2>
              <div className="flex items-center gap-2">
                {rxPdfBlobUrl && (
                  <button
                    onClick={() => downloadRxPdf(viewingRxPdf)}
                    className="p-2 rounded-lg hover:bg-cyan-500/10 transition text-cyan-400"
                    title="Telecharger"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                )}
                <button onClick={closeRxPdfViewer} className="p-2 hover:text-red-400 transition">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              {rxPdfLoading && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-slate-500 text-sm">Chargement du PDF...</p>
                </div>
              )}
              {rxPdfError && (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <p className="text-red-400 text-sm">{rxPdfError}</p>
                  <button onClick={closeRxPdfViewer} className="text-sm text-slate-400 hover:text-white transition">
                    Fermer
                  </button>
                </div>
              )}
              {rxPdfBlobUrl && !rxPdfLoading && !rxPdfError && (
                <iframe src={rxPdfBlobUrl} className="w-full h-full border-0" title="Ordonnance PDF" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== REPORTS ==================== */}
      <div className="glass-card p-6 rounded-xl mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Rapports</h2>
          <Link
            href="/doctor/reports"
            className="text-cyan-400 hover:text-cyan-300 text-sm transition"
          >
            Voir tous les rapports
          </Link>
        </div>
        {reports.length === 0 ? (
          <p className="text-slate-500 text-sm">Aucun rapport pour ce patient</p>
        ) : (
          <div className="space-y-3">
            {reports.map((r: any) => (
              <div key={r.id} className="border border-cyan-500/10 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        r.reportType === 'MENSUEL' ? 'bg-cyan-500/15 text-cyan-400' :
                        r.reportType === 'HEBDOMADAIRE' ? 'bg-purple-500/15 text-purple-400' :
                        r.reportType === 'TRIMESTRIEL' ? 'bg-indigo-500/15 text-indigo-400' :
                        r.reportType === 'URGENCE' ? 'bg-red-500/15 text-red-400' :
                        'bg-cardio-800 text-slate-300'
                      }`}>
                        {r.reportType || 'RAPPORT'}
                      </span>
                      {r.signedAt && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/15 text-green-400">
                          Signe
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-300 mb-1">{r.title || 'Rapport'}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(r.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {r.periodStart && r.periodEnd && (
                        <> — Periode: {new Date(r.periodStart).toLocaleDateString('fr-FR')} au {new Date(r.periodEnd).toLocaleDateString('fr-FR')}</>
                      )}
                    </p>
                    {r.summary && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{r.summary}</p>
                    )}
                  </div>
                  <button
                    onClick={() => downloadReport(r.id)}
                    className="p-2 rounded-lg hover:bg-cyan-500/10 transition text-cyan-400 ml-3 shrink-0"
                    title="Telecharger le PDF"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ==================== IMAGES GALLERY ==================== */}
      {(measurementPhotos.length > 0 || tcImages.length > 0) && (
        <div className="glass-card p-6 rounded-xl mb-6">
          <h2 className="text-lg font-semibold mb-4">Galerie d&apos;images</h2>

          {/* BP Measurement photos */}
          {measurementPhotos.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-slate-400 mb-3">Photos de mesures ({measurementPhotos.length})</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {measurementPhotos.map((photo: any) => (
                  <BpPhotoCard
                    key={photo.id}
                    measurementId={photo.id}
                    date={photo.date}
                    systolic={photo.systolic}
                    diastolic={photo.diastolic}
                    onClick={openLightbox}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Teleconsultation chat images */}
          {tcImages.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-400 mb-3">Images de teleconsultation ({tcImages.length})</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {tcImages.map((img: any, i: number) => (
                  <TcImageCard
                    key={`tc-${i}`}
                    url={img.url}
                    date={img.date}
                    fileName={img.fileName}
                    onClick={openLightbox}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Image Lightbox Modal */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 cursor-pointer"
          onClick={closeLightbox}
        >
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={closeLightbox}
              className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-cardio-900 border border-slate-700 flex items-center justify-center hover:text-red-400 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxUrl}
              alt="Image agrandie"
              className="max-w-full max-h-[85vh] rounded-xl object-contain"
            />
          </div>
        </div>
      )}

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
          <div className="flex gap-2 items-start">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Ajouter une note medicale..."
              rows={3}
              className="flex-1 glass-input rounded-lg px-4 py-2 text-sm resize-none"
            />
            <MicButton isListening={noteSpeech.isListening} onClick={noteSpeech.toggle} />
          </div>
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
