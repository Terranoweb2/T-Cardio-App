'use client';

import { useState } from 'react';
import {
  FileText, Upload, Filter, Loader2, X, Download, MessageSquare,
  Trash2, ExternalLink, FileSearch,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  useExamResults,
  useDeleteExamResult,
  useAnnotateExamResult,
  useExamFileUrl,
  EXAM_TYPE_LABELS,
  EXAM_TYPES,
} from '@/hooks/useExamResults';
import type { ExamResult, ExamType } from '@/hooks/useExamResults';
import ExamCard from '@/components/exam-results/ExamCard';
import ExamUploader from '@/components/exam-results/ExamUploader';
import toast from 'react-hot-toast';

export default function ExamResultsPage() {
  const [filterType, setFilterType] = useState<ExamType | ''>('');
  const [showUploader, setShowUploader] = useState(false);
  const [selectedExam, setSelectedExam] = useState<ExamResult | null>(null);
  const [doctorComment, setDoctorComment] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data: exams, isLoading, refetch } = useExamResults(filterType || undefined);
  const deleteMutation = useDeleteExamResult();
  const annotateMutation = useAnnotateExamResult();

  const handleView = (exam: ExamResult) => {
    setSelectedExam(exam);
    setDoctorComment(exam.doctorComment || '');
  };

  const handleDelete = async (id: string) => {
    if (confirmDelete === id) {
      try {
        await deleteMutation.mutateAsync(id);
        setConfirmDelete(null);
        if (selectedExam?.id === id) setSelectedExam(null);
      } catch {
        // handled by mutation
      }
    } else {
      setConfirmDelete(id);
      // Auto-reset after 3 seconds
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  };

  const handleAnnotate = async () => {
    if (!selectedExam || !doctorComment.trim()) return;
    try {
      await annotateMutation.mutateAsync({ id: selectedExam.id, doctorComment: doctorComment.trim() });
      setSelectedExam({ ...selectedExam, doctorComment: doctorComment.trim() });
    } catch {
      // handled by mutation
    }
  };

  return (
    <div className="page-transition">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gradient-cyan">
          Resultats d&apos;examens
        </h1>
        <button
          onClick={() => setShowUploader(true)}
          className="glow-btn rounded-lg px-4 py-2 text-sm flex items-center gap-2 self-start sm:self-auto"
        >
          <Upload className="w-4 h-4" />
          Telecharger un examen
        </button>
      </div>

      {/* Filter */}
      <div className="mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as ExamType | '')}
            className="glass-input rounded-lg px-3 py-1.5 text-sm min-w-[180px]"
          >
            <option value="">Tous les types</option>
            {EXAM_TYPES.map((t) => (
              <option key={t} value={t}>{EXAM_TYPE_LABELS[t]}</option>
            ))}
          </select>
          {filterType && (
            <button
              onClick={() => setFilterType('')}
              className="text-xs text-slate-400 hover:text-red-400 transition flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Reinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      ) : !exams || exams.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <FileSearch className="w-14 h-14 text-cyan-500/20 mx-auto mb-4" />
          <p className="text-slate-400 mb-1">Aucun resultat d&apos;examen</p>
          <p className="text-xs text-slate-500">
            {filterType
              ? 'Aucun examen de ce type. Essayez un autre filtre.'
              : 'Telechargez votre premier examen pour commencer.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {exams.map((exam) => (
            <ExamCard
              key={exam.id}
              exam={exam}
              onView={handleView}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Upload modal */}
      {showUploader && (
        <ExamUploader
          onClose={() => setShowUploader(false)}
          onSuccess={() => refetch()}
        />
      )}

      {/* Detail / Viewer modal */}
      {selectedExam && (
        <ExamDetailModal
          exam={selectedExam}
          doctorComment={doctorComment}
          onDoctorCommentChange={setDoctorComment}
          onAnnotate={handleAnnotate}
          isAnnotating={annotateMutation.isPending}
          onClose={() => setSelectedExam(null)}
          onDelete={() => handleDelete(selectedExam.id)}
          isDeleting={deleteMutation.isPending}
          confirmDelete={confirmDelete === selectedExam.id}
        />
      )}
    </div>
  );
}

// ─── Detail Modal ────────────────────────────────────────────────────

interface ExamDetailModalProps {
  exam: ExamResult;
  doctorComment: string;
  onDoctorCommentChange: (v: string) => void;
  onAnnotate: () => void;
  isAnnotating: boolean;
  onClose: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  confirmDelete: boolean;
}

function ExamDetailModal({
  exam,
  doctorComment,
  onDoctorCommentChange,
  onAnnotate,
  isAnnotating,
  onClose,
  onDelete,
  isDeleting,
  confirmDelete,
}: ExamDetailModalProps) {
  const { data: fileData } = useExamFileUrl(exam.id);
  const fileUrl = fileData?.url;

  const handleOpenFile = () => {
    if (fileUrl) {
      window.open(fileUrl, '_blank');
    }
  };

  const handleDownloadFile = async () => {
    if (!fileUrl) return;
    try {
      const link = document.createElement('a');
      link.href = fileUrl;
      link.setAttribute('download', exam.fileName || `examen-${exam.id}`);
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error('Erreur lors du telechargement');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="glass-card rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-cyan-500/10">
          <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            Detail de l&apos;examen
          </h2>
          <button onClick={onClose} className="p-1 hover:text-red-400 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 dark-scrollbar">
          {/* Type badge + date */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-cyan-500/15 text-cyan-400">
              {EXAM_TYPE_LABELS[exam.type]}
            </span>
            <span className="text-xs text-slate-500">
              {format(new Date(exam.createdAt), "dd MMMM yyyy 'a' HH:mm", { locale: fr })}
            </span>
          </div>

          {/* Title */}
          {exam.title && (
            <div>
              <label className="text-xs text-slate-500 block mb-0.5">Titre</label>
              <p className="text-sm text-slate-200">{exam.title}</p>
            </div>
          )}

          {/* Notes */}
          {exam.notes && (
            <div>
              <label className="text-xs text-slate-500 block mb-0.5">Notes</label>
              <p className="text-sm text-slate-300">{exam.notes}</p>
            </div>
          )}

          {/* File actions */}
          <div className="flex items-center gap-2">
            {fileUrl && (
              <>
                <button
                  onClick={handleOpenFile}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-cyan-400 hover:bg-cyan-500/10 transition border border-cyan-500/20"
                >
                  <ExternalLink className="w-4 h-4" />
                  Ouvrir le fichier
                </button>
                <button
                  onClick={handleDownloadFile}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-cardio-700/50 transition border border-cyan-500/10"
                >
                  <Download className="w-4 h-4" />
                  Telecharger
                </button>
              </>
            )}
          </div>

          {/* File preview (images only) */}
          {fileUrl && exam.mimeType?.startsWith('image/') && (
            <div className="rounded-xl overflow-hidden border border-cyan-500/10 bg-cardio-800/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fileUrl}
                alt={exam.title || "Resultat d'examen"}
                className="w-full h-auto max-h-[400px] object-contain"
              />
            </div>
          )}

          {/* Doctor comment section */}
          <div className="border-t border-cyan-500/10 pt-4">
            <label className="flex items-center gap-2 text-sm text-slate-400 mb-2">
              <MessageSquare className="w-4 h-4 text-cyan-400" />
              Commentaire du medecin
            </label>

            {exam.doctorComment && (
              <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/10 mb-3">
                <p className="text-sm text-cyan-300">{exam.doctorComment}</p>
              </div>
            )}

            <textarea
              value={doctorComment}
              onChange={(e) => onDoctorCommentChange(e.target.value)}
              rows={3}
              placeholder="Ajouter ou modifier un commentaire..."
              className="w-full glass-input rounded-lg px-3 py-2.5 text-sm resize-none"
            />
            <button
              onClick={onAnnotate}
              disabled={!doctorComment.trim() || isAnnotating}
              className="mt-2 glow-btn rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {isAnnotating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <MessageSquare className="w-4 h-4" />
              )}
              Enregistrer le commentaire
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-cyan-500/10 flex items-center justify-between">
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition ${
              confirmDelete
                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                : 'text-red-400 hover:bg-red-500/10'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            {confirmDelete ? 'Confirmer la suppression' : 'Supprimer'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-cardio-700/50 transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
