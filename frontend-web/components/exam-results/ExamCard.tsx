'use client';

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Droplets, Bone, HeartPulse, Activity, Zap, Waves,
  Scan, BrainCircuit, FileQuestion, FileText, Image as ImageIcon,
  MessageSquare, Trash2, Eye,
} from 'lucide-react';
import type { ExamResult, ExamType } from '@/hooks/useExamResults';
import { EXAM_TYPE_LABELS } from '@/hooks/useExamResults';

// ─── Icon + color map per exam type ──────────────────────────────────

const EXAM_TYPE_CONFIG: Record<ExamType, { icon: typeof Droplets; color: string; bg: string }> = {
  BLOOD_TEST:      { icon: Droplets,     color: 'text-red-400',     bg: 'bg-red-500/15' },
  XRAY:            { icon: Bone,         color: 'text-slate-300',   bg: 'bg-slate-500/15' },
  ECHOCARDIOGRAM:  { icon: HeartPulse,   color: 'text-pink-400',    bg: 'bg-pink-500/15' },
  HOLTER:          { icon: Activity,     color: 'text-amber-400',   bg: 'bg-amber-500/15' },
  ECG_EXAM:        { icon: Zap,          color: 'text-yellow-400',  bg: 'bg-yellow-500/15' },
  STRESS_TEST:     { icon: Activity,     color: 'text-orange-400',  bg: 'bg-orange-500/15' },
  DOPPLER:         { icon: Waves,        color: 'text-blue-400',    bg: 'bg-blue-500/15' },
  SCANNER:         { icon: Scan,         color: 'text-teal-400',    bg: 'bg-teal-500/15' },
  MRI:             { icon: BrainCircuit, color: 'text-purple-400',  bg: 'bg-purple-500/15' },
  OTHER_EXAM:      { icon: FileQuestion, color: 'text-cyan-400',    bg: 'bg-cyan-500/15' },
};

interface ExamCardProps {
  exam: ExamResult;
  onView: (exam: ExamResult) => void;
  onDelete?: (id: string) => void;
}

export default function ExamCard({ exam, onView, onDelete }: ExamCardProps) {
  const config = EXAM_TYPE_CONFIG[exam.type] || EXAM_TYPE_CONFIG.OTHER_EXAM;
  const TypeIcon = config.icon;

  const isPdf = exam.mimeType?.includes('pdf');
  const isImage = exam.mimeType?.startsWith('image/');

  return (
    <div
      className="glass-card rounded-xl p-4 hover:border-cyan-500/20 border border-transparent transition-all duration-200 cursor-pointer group"
      onClick={() => onView(exam)}
    >
      {/* Header: type badge + file type icon */}
      <div className="flex items-start justify-between mb-3">
        <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg ${config.bg}`}>
          <TypeIcon className={`w-4 h-4 ${config.color}`} />
          <span className={`text-xs font-semibold ${config.color}`}>
            {EXAM_TYPE_LABELS[exam.type]}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isPdf && <FileText className="w-4 h-4 text-red-400/60" />}
          {isImage && <ImageIcon className="w-4 h-4 text-blue-400/60" />}
        </div>
      </div>

      {/* Title */}
      {exam.title && (
        <h3 className="text-sm font-semibold text-slate-200 mb-1 line-clamp-1">
          {exam.title}
        </h3>
      )}

      {/* Date */}
      <p className="text-xs text-slate-500 mb-2">
        {format(new Date(exam.createdAt), 'dd MMMM yyyy', { locale: fr })}
      </p>

      {/* Notes preview */}
      {exam.notes && (
        <p className="text-xs text-slate-400 line-clamp-2 mb-2">
          {exam.notes}
        </p>
      )}

      {/* Doctor comment */}
      {exam.doctorComment && (
        <div className="flex items-start gap-2 mt-2 p-2 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
          <MessageSquare className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
          <p className="text-xs text-cyan-300 line-clamp-2">{exam.doctorComment}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onView(exam); }}
          className="p-1.5 rounded-lg hover:bg-cyan-500/10 transition text-cyan-400"
          title="Voir le fichier"
        >
          <Eye className="w-4 h-4" />
        </button>
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(exam.id); }}
            className="p-1.5 rounded-lg hover:bg-red-500/10 transition text-red-400"
            title="Supprimer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
