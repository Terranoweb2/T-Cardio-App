'use client';

import { useState } from 'react';
import { Pencil, Trash2, Clock, Calendar, Pill } from 'lucide-react';
import { type Medication, useDeleteMedication, useUpdateMedication } from '@/hooks/useMedications';
import EditMedicationModal from './EditMedicationModal';

interface MedicationCardProps {
  medication: Medication;
}

const frequencyLabels: Record<string, string> = {
  ONCE_DAILY: 'Une fois/jour',
  TWICE_DAILY: 'Deux fois/jour',
  THREE_DAILY: 'Trois fois/jour',
  EVERY_OTHER_DAY: 'Tous les 2 jours',
  WEEKLY: 'Hebdomadaire',
  AS_NEEDED: 'Au besoin',
};

export function getFrequencyLabel(frequency: string): string {
  return frequencyLabels[frequency] || frequency;
}

export default function MedicationCard({ medication }: MedicationCardProps) {
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteMutation = useDeleteMedication();
  const updateMutation = useUpdateMedication();

  const handleDelete = () => {
    deleteMutation.mutate(medication.id, {
      onSuccess: () => setShowDeleteConfirm(false),
    });
  };

  const handleToggleActive = () => {
    updateMutation.mutate({
      id: medication.id,
      isActive: !medication.isActive,
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <>
      <div className="glass-card rounded-xl p-4 hover:border-cyan-500/20 transition-all duration-200">
        <div className="flex items-start justify-between gap-3">
          {/* Left: Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Pill className="w-4 h-4 text-cyan-400 shrink-0" />
              <h3 className="font-semibold text-slate-200 truncate">{medication.name}</h3>
              <span
                className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                  medication.isActive
                    ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                    : 'bg-slate-500/15 text-slate-400 border border-slate-500/20'
                }`}
              >
                {medication.isActive ? 'Actif' : 'Inactif'}
              </span>
            </div>

            {medication.dosage && (
              <p className="text-sm text-slate-300 mb-1">{medication.dosage}</p>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {getFrequencyLabel(medication.frequency)}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(medication.startDate)}
                {medication.endDate && ` - ${formatDate(medication.endDate)}`}
              </span>
            </div>

            {medication.reminderTimes && medication.reminderTimes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {medication.reminderTimes.map((time, i) => (
                  <span
                    key={i}
                    className="text-xs bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/15"
                  >
                    {time}
                  </span>
                ))}
              </div>
            )}

            {medication.notes && (
              <p className="text-xs text-slate-500 mt-2 italic line-clamp-2">{medication.notes}</p>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setShowEdit(true)}
              className="p-2 rounded-lg hover:bg-cyan-500/10 transition text-slate-400 hover:text-cyan-400"
              title="Modifier"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 rounded-lg hover:bg-red-500/10 transition text-slate-400 hover:text-red-400"
              title="Supprimer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirmation overlay */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-slate-200 mb-2">Confirmer la suppression</h3>
            <p className="text-sm text-slate-400 mb-6">
              Voulez-vous vraiment supprimer <span className="text-slate-200 font-medium">{medication.name}</span> ?
              Cette action est irreversible.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2.5 border border-slate-600 rounded-lg text-slate-300 hover:bg-cardio-700/50 transition text-sm font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition text-sm font-medium disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {showEdit && (
        <EditMedicationModal
          medication={medication}
          onClose={() => setShowEdit(false)}
        />
      )}
    </>
  );
}
