'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, Image as ImageIcon, Loader2, File } from 'lucide-react';
import { useUploadExamResult, EXAM_TYPE_LABELS, EXAM_TYPES } from '@/hooks/useExamResults';
import type { ExamType } from '@/hooks/useExamResults';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png';

interface ExamUploaderProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ExamUploader({ onClose, onSuccess }: ExamUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<ExamType>('BLOOD_TEST');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useUploadExamResult();

  const validateFile = (f: File): boolean => {
    setFileError(null);
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setFileError('Format non supporte. Formats acceptes : PDF, JPEG, PNG');
      return false;
    }
    if (f.size > MAX_FILE_SIZE) {
      setFileError('Fichier trop volumineux. Taille maximale : 20 Mo');
      return false;
    }
    return true;
  };

  const handleFileSelect = (f: File) => {
    if (validateFile(f)) {
      setFile(f);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) handleFileSelect(selected);
  };

  const handleSubmit = async () => {
    if (!file) return;

    try {
      await uploadMutation.mutateAsync({ file, type, title: title || undefined, notes: notes || undefined });
      onSuccess?.();
      onClose();
    } catch {
      // Error already handled by mutation onError
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  const getFileIcon = () => {
    if (!file) return null;
    if (file.type === 'application/pdf') return <FileText className="w-8 h-8 text-red-400" />;
    if (file.type.startsWith('image/')) return <ImageIcon className="w-8 h-8 text-blue-400" />;
    return <File className="w-8 h-8 text-slate-400" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="glass-card rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto dark-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-slate-200">Telecharger un examen</h2>
          <button onClick={onClose} className="p-1 hover:text-red-400 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drop zone */}
        {!file ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200
              ${dragOver
                ? 'border-cyan-400 bg-cyan-500/10'
                : 'border-cyan-500/20 hover:border-cyan-500/40 hover:bg-cardio-800/50'
              }
            `}
          >
            <Upload className={`w-10 h-10 mx-auto mb-3 ${dragOver ? 'text-cyan-400' : 'text-slate-500'}`} />
            <p className="text-sm text-slate-300 mb-1">
              Glissez-deposez votre fichier ici
            </p>
            <p className="text-xs text-slate-500">
              ou cliquez pour parcourir
            </p>
            <p className="text-xs text-slate-600 mt-2">
              PDF, JPEG, PNG — Max 20 Mo
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              onChange={handleInputChange}
              className="hidden"
            />
          </div>
        ) : (
          /* File preview */
          <div className="glass-card rounded-xl p-4 mb-4">
            <div className="flex items-center gap-3">
              {getFileIcon()}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 truncate">{file.name}</p>
                <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
              </div>
              <button
                onClick={() => { setFile(null); setFileError(null); }}
                className="p-1.5 rounded-lg hover:bg-red-500/10 transition text-red-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {fileError && (
          <div className="mt-2 mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {fileError}
          </div>
        )}

        {/* Type selector */}
        <div className="mt-4 mb-4">
          <label className="block text-sm text-slate-400 mb-1">Type d&apos;examen</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ExamType)}
            className="w-full glass-input rounded-lg px-3 py-2.5 text-sm"
          >
            {EXAM_TYPES.map((t) => (
              <option key={t} value={t}>{EXAM_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div className="mb-4">
          <label className="block text-sm text-slate-400 mb-1">Titre (optionnel)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Bilan sanguin complet"
            className="w-full glass-input rounded-lg px-3 py-2.5 text-sm"
          />
        </div>

        {/* Notes */}
        <div className="mb-6">
          <label className="block text-sm text-slate-400 mb-1">Notes (optionnel)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Remarques, contexte de l'examen..."
            className="w-full glass-input rounded-lg px-3 py-2.5 text-sm resize-none"
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!file || uploadMutation.isPending}
          className="w-full glow-btn rounded-lg py-3 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {uploadMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {uploadMutation.isPending ? 'Envoi en cours...' : 'Telecharger'}
        </button>
      </div>
    </div>
  );
}
