'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import api from '@/lib/api';

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

interface PostConsultationModalProps {
  teleconsultationId: string;
  onClose: () => void;
  onSaved?: () => void;
}

export default function PostConsultationModal({
  teleconsultationId,
  onClose,
  onSaved,
}: PostConsultationModalProps) {
  const [summary, setSummary] = useState('');
  const [followUpNeeded, setFollowUpNeeded] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const speech = useSpeechToText(useCallback((text: string) => {
    setSummary((prev) => (prev ? prev + ' ' : '') + text);
  }, []));

  const handleSave = async () => {
    if (!summary.trim()) return;
    setSaving(true);
    setError('');
    try {
      await api.patch(`/teleconsultations/${teleconsultationId}/summary`, {
        summary: summary.trim(),
        followUpNeeded,
        followUpDate: followUpDate || undefined,
      });
      onSaved?.();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-card rounded-2xl w-full max-w-lg">
        {/* Header */}
        <div className="px-6 py-4 border-b border-cyan-500/10">
          <h2 className="text-lg font-semibold text-slate-100">Resume de la consultation</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Redigez un resume de la teleconsultation pour le dossier medical.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Summary textarea */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Resume de la consultation *
            </label>
            <div className="flex gap-2 items-start">
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Observations, recommandations, points discutes..."
                rows={5}
                className="flex-1 glass-input rounded-lg px-3 py-2 text-sm resize-none"
                autoFocus
              />
              <button
                type="button"
                onClick={speech.toggle}
                title={speech.isListening ? 'Arreter la dictee' : 'Dicter (micro)'}
                className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border transition shrink-0 mt-0.5 ${
                  speech.isListening
                    ? 'bg-red-500/20 border-red-500/40 text-red-400 animate-pulse'
                    : 'glass-input border-cyan-500/15 text-slate-400 hover:text-cyan-400'
                }`}
              >
                {speech.isListening ? (
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
            </div>
          </div>

          {/* Follow-up checkbox */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="followUp"
              checked={followUpNeeded}
              onChange={(e) => setFollowUpNeeded(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-cyan-500/15 text-cyan-400 focus:ring-cyan-500 bg-cardio-800"
            />
            <label htmlFor="followUp" className="text-sm text-slate-300 cursor-pointer">
              Suivi necessaire
            </label>
          </div>

          {/* Follow-up date (conditional) */}
          {followUpNeeded && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Date de suivi
              </label>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="w-full glass-input rounded-lg px-3 py-2 text-sm"
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-cyan-500/10 flex flex-col sm:flex-row justify-end gap-3">
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-300 px-4 py-2 text-sm transition"
          >
            Passer
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !summary.trim()}
            className="glow-btn px-6 py-2 rounded-lg disabled:opacity-50 transition text-sm font-medium"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer le resume'}
          </button>
        </div>
      </div>
    </div>
  );
}
