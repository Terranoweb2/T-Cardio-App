'use client';

import { useState } from 'react';
import {
  Calendar,
  Clock,
  User,
  Stethoscope,
  FileText,
  Check,
  X,
  Ban,
  Loader2,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  type Appointment,
  useConfirmAppointment,
  useRejectAppointment,
  useCancelAppointment,
  useDeleteAppointment,
} from '@/hooks/useAppointments';

interface AppointmentCardProps {
  appointment: Appointment;
  viewerRole: 'PATIENT' | 'MEDECIN' | 'CARDIOLOGUE' | 'ADMIN';
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  APPT_PENDING: {
    label: 'EN ATTENTE',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/15 border-amber-500/20',
  },
  CONFIRMED: {
    label: 'CONFIRME',
    color: 'text-green-400',
    bgColor: 'bg-green-500/15 border-green-500/20',
  },
  REJECTED: {
    label: 'REJETE',
    color: 'text-red-400',
    bgColor: 'bg-red-500/15 border-red-500/20',
  },
  CANCELLED: {
    label: 'ANNULE',
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/15 border-slate-500/20',
  },
  COMPLETED: {
    label: 'TERMINE',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/15 border-cyan-500/20',
  },
  EXPIRED: {
    label: 'PASSE',
    color: 'text-red-400',
    bgColor: 'bg-red-500/15 border-red-500/20',
  },
};

export default function AppointmentCard({
  appointment,
  viewerRole,
}: AppointmentCardProps) {
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [showCancelInput, setShowCancelInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const confirmMutation = useConfirmAppointment();
  const rejectMutation = useRejectAppointment();
  const cancelMutation = useCancelAppointment();
  const deleteMutation = useDeleteAppointment();

  const isDoctor = viewerRole === 'MEDECIN' || viewerRole === 'CARDIOLOGUE';
  const isPatient = viewerRole === 'PATIENT';

  // Check if appointment date is in the past
  const scheduledDate = new Date(appointment.scheduledAt);
  const isPast = scheduledDate < new Date();

  // Override status for past appointments that are still CONFIRMED or PENDING
  const effectiveStatus = isPast && (appointment.status === 'CONFIRMED' || appointment.status === 'APPT_PENDING')
    ? 'EXPIRED'
    : appointment.status;

  const statusCfg = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.CANCELLED;

  const canConfirm = isDoctor && appointment.status === 'APPT_PENDING' && !isPast;
  const canReject = isDoctor && appointment.status === 'APPT_PENDING' && !isPast;
  const canCancel =
    (isPatient || isDoctor) &&
    (appointment.status === 'APPT_PENDING' || appointment.status === 'CONFIRMED') &&
    !isPast;
  const canDelete = isPast || appointment.status === 'CANCELLED' || appointment.status === 'REJECTED';
  const dateStr = scheduledDate.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const timeStr = scheduledDate.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });

  // Displayed person depends on viewer role
  const personName = isDoctor
    ? appointment.patient
      ? `${appointment.patient.firstName} ${appointment.patient.lastName}`
      : 'Patient'
    : appointment.doctor
      ? `Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}`
      : 'Praticien';

  const personSpecialty = !isDoctor && appointment.doctor?.specialty;

  const handleConfirm = () => {
    confirmMutation.mutate(appointment.id);
  };

  const handleReject = () => {
    rejectMutation.mutate(
      { appointmentId: appointment.id, reason: rejectReason || undefined },
      { onSuccess: () => setShowRejectInput(false) },
    );
  };

  const handleCancel = () => {
    cancelMutation.mutate(
      { appointmentId: appointment.id, reason: cancelReason || undefined },
      { onSuccess: () => setShowCancelInput(false) },
    );
  };

  return (
    <div className={`glass-card rounded-xl border overflow-hidden transition-all duration-200 ${isPast ? 'border-red-500/20 opacity-75' : 'border-cyan-500/10 hover:border-cyan-500/20'}`}>
      {/* Status strip */}
      <div className={`h-1 ${isPast ? 'bg-red-500/30' : statusCfg.bgColor.split(' ')[0]}`} />

      {/* Past indicator */}
      {isPast && (
        <div className="flex items-center gap-2 px-4 pt-3 pb-0">
          <XCircle className="w-4 h-4 text-red-400" />
          <span className="text-xs font-medium text-red-400">Rendez-vous passe</span>
        </div>
      )}

      <div className="p-4 sm:p-5">
        {/* Header: person + status */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-600/30 to-teal-600/30 rounded-full flex items-center justify-center shrink-0 border border-cyan-500/20">
              {isDoctor ? (
                <User className="w-5 h-5 text-cyan-400" />
              ) : (
                <Stethoscope className="w-5 h-5 text-cyan-400" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-200 truncate">
                {personName}
              </p>
              {personSpecialty && (
                <p className="text-xs text-slate-500 truncate">{personSpecialty}</p>
              )}
            </div>
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${statusCfg.bgColor} ${statusCfg.color} shrink-0`}
          >
            {statusCfg.label}
          </span>
        </div>

        {/* Date & time */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400 mb-3">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="capitalize">{dateStr}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-slate-500" />
            {timeStr}
            {appointment.durationMin && (
              <span className="text-xs text-slate-500">({appointment.durationMin} min)</span>
            )}
          </span>
        </div>

        {/* Reason */}
        {appointment.reason && (
          <div className="flex items-start gap-2 mb-3 bg-cardio-800/50 rounded-lg p-2.5">
            <FileText className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-300">{appointment.reason}</p>
          </div>
        )}

        {/* Rejection reason */}
        {appointment.status === 'REJECTED' && appointment.rejectionReason && (
          <div className="flex items-start gap-2 mb-3 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
            <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">
              <span className="font-medium">Motif du rejet :</span> {appointment.rejectionReason}
            </p>
          </div>
        )}

        {/* Cancellation reason */}
        {appointment.status === 'CANCELLED' && appointment.cancellationReason && (
          <div className="flex items-start gap-2 mb-3 bg-slate-500/10 border border-slate-500/20 rounded-lg p-2.5">
            <Ban className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-300">
              <span className="font-medium">Motif d&apos;annulation :</span>{' '}
              {appointment.cancellationReason}
            </p>
          </div>
        )}

        {/* Reject reason input */}
        {showRejectInput && (
          <div className="mb-3 space-y-2">
            <input
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Motif du rejet (optionnel)..."
              className="w-full glass-input rounded-lg px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={handleReject}
                disabled={rejectMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition"
              >
                {rejectMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <X className="w-3.5 h-3.5" />
                )}
                Confirmer le rejet
              </button>
              <button
                onClick={() => setShowRejectInput(false)}
                className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-300 transition"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Cancel reason input */}
        {showCancelInput && (
          <div className="mb-3 space-y-2">
            <input
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Motif d'annulation (optionnel)..."
              className="w-full glass-input rounded-lg px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                disabled={cancelMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition"
              >
                {cancelMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Ban className="w-3.5 h-3.5" />
                )}
                Confirmer l&apos;annulation
              </button>
              <button
                onClick={() => setShowCancelInput(false)}
                className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-300 transition"
              >
                Retour
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {(canConfirm || canReject || canCancel || canDelete) && !showRejectInput && !showCancelInput && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-cyan-500/10 mt-3">
            {canConfirm && (
              <button
                onClick={handleConfirm}
                disabled={confirmMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition"
              >
                {confirmMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                Confirmer
              </button>
            )}
            {canReject && (
              <button
                onClick={() => setShowRejectInput(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm font-medium transition"
              >
                <X className="w-3.5 h-3.5" />
                Rejeter
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => setShowCancelInput(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-600/20 hover:bg-slate-600/30 text-slate-400 rounded-lg text-sm font-medium transition"
              >
                <Ban className="w-3.5 h-3.5" />
                Annuler
              </button>
            )}
            {canDelete && !showDeleteConfirm && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm font-medium transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Supprimer
              </button>
            )}
            {canDelete && showDeleteConfirm && (
              <div className="flex items-center gap-2 w-full">
                <span className="text-xs text-red-400">Confirmer ?</span>
                <button
                  onClick={() => deleteMutation.mutate(appointment.id)}
                  disabled={deleteMutation.isPending}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium disabled:opacity-50 transition"
                >
                  {deleteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  Oui
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-300 transition"
                >
                  Non
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
