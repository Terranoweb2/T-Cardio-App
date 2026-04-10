import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { TeleconsultationStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { EmergencyGateway } from '../emergency/emergency.gateway';
import { StorageService } from '../storage/storage.service';
import { CreditService } from '../credit/credit.service';
import { EmailService } from '../../core/email/email.service';
import { DoctorWalletService } from '../doctor-wallet/doctor-wallet.service';

@Injectable()
export class TeleconsultationService {
  private readonly logger = new Logger(TeleconsultationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emergencyGateway: EmergencyGateway,
    private readonly storageService: StorageService,
    private readonly creditService: CreditService,
    private readonly emailService: EmailService,
    private readonly doctorWalletService: DoctorWalletService,
  ) {}

  /**
   * Check if a time slot conflicts with an existing consultation for the doctor.
   * Throws BadRequestException if conflict is found.
   */
  private async checkSlotConflict(doctorId: string, scheduledAt: Date, durationMinutes: number) {
    const slotStart = scheduledAt.getTime();
    const slotEnd = slotStart + durationMinutes * 60 * 1000;

    // Fetch all PLANNED/ACTIVE consultations for this doctor around the target date
    const dayStart = new Date(scheduledAt);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(scheduledAt);
    dayEnd.setHours(23, 59, 59, 999);

    const existing = await this.prisma.teleconsultation.findMany({
      where: {
        doctorId,
        status: { in: ['PLANNED', 'ACTIVE'] },
        scheduledAt: { gte: dayStart, lte: dayEnd },
      },
      select: { scheduledAt: true, durationMinutes: true },
    });

    for (const c of existing) {
      if (!c.scheduledAt) continue;
      const cStart = new Date(c.scheduledAt).getTime();
      const cEnd = cStart + (c.durationMinutes || 15) * 60 * 1000;
      if (slotStart < cEnd && slotEnd > cStart) {
        throw new BadRequestException(
          'Ce creneau est deja reserve. Veuillez choisir un autre horaire.',
        );
      }
    }
  }

  async schedule(doctorUserId: string, data: {
    patientId: string;
    scheduledAt: string;
    durationMinutes?: number;
    reason?: string;
  }) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { userId: doctorUserId },
      include: { user: { select: { email: true } } },
    });
    if (!doctor) throw new NotFoundException('Doctor profile not found');

    const scheduledDate = new Date(data.scheduledAt);
    const duration = data.durationMinutes || doctor.defaultDurationMinutes || 15;

    // Prevent double-booking
    await this.checkSlotConflict(doctor.id, scheduledDate, duration);

    const teleconsultation = await this.prisma.teleconsultation.create({
      data: {
        patientId: data.patientId,
        doctorId: doctor.id,
        scheduledAt: scheduledDate,
        durationMinutes: duration,
        reason: data.reason,
        rtcRoomId: uuidv4(),
      },
    });

    // Create notification for the patient
    try {
      const doctorName = `Dr. ${doctor.firstName || ''} ${doctor.lastName || ''}`.trim();
      const scheduledDateStr = scheduledDate.toLocaleString('fr-FR', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });

      // Find patient userId for notification
      const patient = await this.prisma.patient.findUnique({
        where: { id: data.patientId },
        select: { userId: true },
      });

      await this.prisma.alert.create({
        data: {
          patientId: data.patientId,
          doctorId: doctor.id,
          type: 'SYSTEM',
          title: 'Nouvelle teleconsultation planifiee',
          message: `${doctorName} a planifie une teleconsultation le ${scheduledDateStr}.`,
          severity: 'FAIBLE',
        },
      });

      // Push real-time notification to patient
      if (patient?.userId) {
        this.emergencyGateway.notifyPatient(patient.userId, `Nouvelle teleconsultation planifiee par ${doctorName}`);
      }
    } catch (err) {
      this.logger.warn(`Failed to create notification for teleconsultation: ${err}`);
    }

    return teleconsultation;
  }

  async updateStatus(id: string, status: TeleconsultationStatus, userId?: string) {
    const consultation = await this.prisma.teleconsultation.findUnique({ where: { id } });
    if (!consultation) throw new NotFoundException('Teleconsultation not found');

    // Skip if status is already the same (idempotent)
    if (consultation.status === status) {
      return consultation;
    }

    const previousStatus = consultation.status;
    const data: any = { status };
    if (status === 'ACTIVE' && !consultation.startedAt) data.startedAt = new Date();
    if (status === 'ENDED') data.endedAt = new Date();
    if (status === 'CANCELLED') {
      data.cancelledAt = new Date();
      data.cancelledBy = userId;
    }

    // Atomic update: only update if status hasn't changed concurrently
    const result = await this.prisma.teleconsultation.updateMany({
      where: { id, status: previousStatus },
      data,
    });

    // If no rows updated, status was already changed by another request
    if (result.count === 0) {
      const current = await this.prisma.teleconsultation.findUnique({ where: { id } });
      return current;
    }

    const updated = await this.prisma.teleconsultation.findUnique({ where: { id } });

    // Deduct teleconsultation credits when transitioning TO ACTIVE
    if (status === 'ACTIVE' && previousStatus !== 'ACTIVE' && consultation.patientId) {
      try {
        // Use the doctor's configured price; fall back to 5000 XOF if not set
        let price = 5000;
        if (consultation.doctorId) {
          const doctor = await this.prisma.doctor.findUnique({
            where: { id: consultation.doctorId },
            select: { consultationPriceXof: true },
          });
          price = doctor?.consultationPriceXof ?? 5000;
        }
        await this.creditService.deductForTeleconsultation(consultation.patientId, id, price);
        this.logger.log(`Credits deducted for teleconsultation ${id}, patient ${consultation.patientId}, amount=${price}`);
      } catch (err) {
        this.logger.warn(`Credit deduction failed for teleconsultation ${id}: ${err.message}`);
      }
    }

    // Credit doctor wallet when teleconsultation ENDS (doctor price minus platform commission)
    if (status === 'ENDED' && previousStatus !== 'ENDED' && consultation.doctorId) {
      try {
        const doctorId = consultation.doctorId; // narrowed to string by the if-guard
        const doctor = await this.prisma.doctor.findUnique({
          where: { id: doctorId },
          select: { consultationPriceXof: true, platformCommissionPct: true },
        });
        const price = doctor?.consultationPriceXof ?? 5000;
        const commissionPct = doctor?.platformCommissionPct ?? 20;
        await this.doctorWalletService.creditForTeleconsultation(doctorId, id, price, commissionPct);
        this.logger.log(`Doctor wallet credited for teleconsultation ${id}, doctor ${doctorId}`);
      } catch (err) {
        this.logger.warn(`Doctor wallet credit failed for teleconsultation ${id}: ${err.message}`);
      }
    }

    return updated;
  }

  async addSummary(id: string, doctorUserId: string, data: {
    summary: string;
    followUpNeeded: boolean;
    followUpDate?: string;
  }) {
    const consultation = await this.prisma.teleconsultation.findUnique({ where: { id } });
    if (!consultation) throw new NotFoundException('Teleconsultation not found');

    const doctor = await this.prisma.doctor.findUnique({ where: { userId: doctorUserId } });

    // Update teleconsultation with summary
    const updated = await this.prisma.teleconsultation.update({
      where: { id },
      data: {
        summary: data.summary,
        followUpNeeded: data.followUpNeeded,
        followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
      },
    });

    // Also create a medical note linked to the teleconsultation
    if (doctor) {
      try {
        await this.prisma.medicalNote.create({
          data: {
            patientId: consultation.patientId,
            doctorId: doctor.id,
            teleconsultationId: id,
            noteType: 'SUIVI',
            content: data.summary,
          },
        });
      } catch (err) {
        this.logger.warn(`Failed to create medical note for teleconsultation ${id}: ${err}`);
      }
    }

    return updated;
  }

  // ==================== RESCHEDULE ====================

  async reschedule(teleconsultationId: string, doctorUserId: string, newScheduledAt: string) {
    const doctor = await this.prisma.doctor.findUnique({ where: { userId: doctorUserId } });
    if (!doctor) throw new NotFoundException('Medecin non trouve');

    const tc = await this.prisma.teleconsultation.findUnique({
      where: { id: teleconsultationId },
    });
    if (!tc) throw new NotFoundException('Teleconsultation introuvable');
    if (tc.doctorId !== doctor.id) throw new BadRequestException('Vous n\'etes pas le medecin de ce rendez-vous');
    if (tc.status !== 'PLANNED') throw new BadRequestException('Seul un rendez-vous planifie peut etre reporte');

    const scheduledAt = new Date(newScheduledAt);
    if (isNaN(scheduledAt.getTime())) throw new BadRequestException('Date invalide');
    if (scheduledAt <= new Date()) throw new BadRequestException('La date doit etre dans le futur');

    // Update teleconsultation
    const updated = await this.prisma.teleconsultation.update({
      where: { id: teleconsultationId },
      data: { scheduledAt },
      include: { patient: { include: { user: { select: { email: true } } } } },
    });

    // Also update linked appointment if exists
    await this.prisma.appointment.updateMany({
      where: { teleconsultationId, status: 'CONFIRMED' },
      data: { scheduledAt },
    });

    this.logger.log(`Teleconsultation ${teleconsultationId} rescheduled to ${scheduledAt.toISOString()}`);
    return { ...updated, motif: updated.reason || null };
  }

  // ==================== CANCEL APPOINTMENT ====================

  async cancelAppointment(teleconsultationId: string, doctorUserId: string, reason?: string) {
    const doctor = await this.prisma.doctor.findUnique({ where: { userId: doctorUserId } });
    if (!doctor) throw new NotFoundException('Medecin non trouve');

    const tc = await this.prisma.teleconsultation.findUnique({
      where: { id: teleconsultationId },
    });
    if (!tc) throw new NotFoundException('Teleconsultation introuvable');
    if (tc.doctorId !== doctor.id) throw new BadRequestException('Vous n\'etes pas le medecin de ce rendez-vous');
    if (tc.status !== 'PLANNED') throw new BadRequestException('Seul un rendez-vous planifie peut etre annule');

    // Cancel teleconsultation
    const updated = await this.prisma.teleconsultation.update({
      where: { id: teleconsultationId },
      data: { status: 'CANCELLED', cancelledBy: 'DOCTOR', cancellationReason: reason || null, cancelledAt: new Date() },
      include: { patient: { include: { user: { select: { email: true } } } } },
    });

    // Also cancel linked appointment
    await this.prisma.appointment.updateMany({
      where: { teleconsultationId, status: { in: ['APPT_PENDING', 'CONFIRMED'] } },
      data: { status: 'CANCELLED', cancelledBy: 'DOCTOR', cancelReason: reason || null },
    });

    this.logger.log(`Teleconsultation ${teleconsultationId} cancelled by doctor`);
    return { ...updated, motif: updated.reason || null };
  }

  async delete(teleconsultationId: string, doctorUserId: string) {
    const doctor = await this.prisma.doctor.findUnique({ where: { userId: doctorUserId } });
    if (!doctor) throw new NotFoundException('Doctor profile not found');

    const tc = await this.prisma.teleconsultation.findUnique({
      where: { id: teleconsultationId },
    });
    if (!tc) throw new NotFoundException('Teleconsultation introuvable');
    if (tc.doctorId !== doctor.id) throw new BadRequestException('Vous ne pouvez supprimer que vos propres teleconsultations');
    if (tc.status === 'ACTIVE') throw new BadRequestException('Impossible de supprimer une teleconsultation en cours');

    // Delete related records first (messages, notes, review, appointment)
    await this.prisma.teleconsultationMessage.deleteMany({ where: { teleconsultationId } });
    await this.prisma.medicalNote.deleteMany({ where: { teleconsultationId } });
    await this.prisma.doctorReview.deleteMany({ where: { teleconsultationId } });
    await this.prisma.appointment.deleteMany({ where: { teleconsultationId } });
    await this.prisma.teleconsultation.delete({ where: { id: teleconsultationId } });

    this.logger.log(`Teleconsultation ${teleconsultationId} deleted by doctor ${doctor.id}`);
    return { success: true };
  }

  async findByDoctor(doctorUserId: string) {
    const doctor = await this.prisma.doctor.findUnique({ where: { userId: doctorUserId } });
    if (!doctor) return [];

    const teleconsultations = await this.prisma.teleconsultation.findMany({
      where: { doctorId: doctor.id },
      include: { patient: { include: { user: { select: { email: true } } } } },
      orderBy: { createdAt: 'desc' },
    });

    // Map reason → motif for frontend compatibility
    return teleconsultations.map((tc) => ({
      ...tc,
      motif: tc.reason || null,
    }));
  }

  async findByPatient(patientUserId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { userId: patientUserId } });
    if (!patient) return [];

    const teleconsultations = await this.prisma.teleconsultation.findMany({
      where: { patientId: patient.id },
      include: { doctor: true },
      orderBy: { createdAt: 'desc' },
    });

    // Map reason → motif for frontend compatibility
    return teleconsultations.map((tc) => ({
      ...tc,
      motif: tc.reason || null,
    }));
  }

  async requestByPatient(patientUserId: string, motif: string, scheduledAt?: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { userId: patientUserId },
      include: { user: { select: { email: true } } },
    });
    if (!patient) throw new NotFoundException('Patient profile not found');

    // Find assigned doctor (first active link)
    const link = await this.prisma.patientDoctorLink.findFirst({
      where: { patientId: patient.id, status: 'ACTIVE' },
      include: {
        doctor: { include: { user: { select: { email: true } } } },
      },
    });

    const doctor = link?.doctor || null;
    const scheduledDate = scheduledAt ? new Date(scheduledAt) : new Date();
    const duration = doctor?.defaultDurationMinutes || 15;

    // Prevent double-booking if a doctor and specific time are provided
    if (doctor && scheduledAt) {
      await this.checkSlotConflict(doctor.id, scheduledDate, duration);
    }

    const teleconsultation = await this.prisma.teleconsultation.create({
      data: {
        patientId: patient.id,
        doctorId: doctor?.id || null,
        reason: motif,
        rtcRoomId: uuidv4(),
        status: 'PLANNED',
        scheduledAt: scheduledDate,
        durationMinutes: duration,
      },
    });

    // Notify doctor: alert + email + WebSocket
    if (doctor) {
      try {
        const patientName = `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || patient.user?.email || 'Un patient';
        const rawDoctorName = `${doctor.firstName || ''} ${doctor.lastName || ''}`.trim();
        const doctorName = rawDoctorName.startsWith('Dr.') ? rawDoctorName : `Dr. ${rawDoctorName}`;
        const dateStr = scheduledDate.toLocaleString('fr-FR', {
          weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });

        // Alert in-app for doctor
        await this.prisma.alert.create({
          data: {
            patientId: patient.id,
            doctorId: doctor.id,
            type: 'SYSTEM',
            title: 'Nouveau rendez-vous teleconsultation',
            message: `${patientName} a reserve une teleconsultation le ${dateStr}. Motif: ${motif || 'Non precise'}.`,
            severity: 'MODERE',
          },
        });

        // WebSocket notification to doctor
        if (doctor.userId) {
          this.emergencyGateway.notifyDoctor(doctor.userId, {
            type: 'new_booking',
            teleconsultationId: teleconsultation.id,
            patientName,
            scheduledAt: scheduledDate.toISOString(),
            message: `Nouveau RDV: ${patientName} le ${dateStr}`,
          });
        }

        // Email notification to doctor
        const doctorEmail = doctor.user?.email;
        if (doctorEmail) {
          this.emailService.sendTemplate(
            doctorEmail,
            `T-Cardio: Nouveau rendez-vous - ${patientName}`,
            'booking-notification',
            {
              doctorName,
              patientName,
              date: dateStr,
              motif: motif || 'Non precise',
              duration,
            },
          ).catch(() => {});
        }
      } catch (err) {
        this.logger.warn(`Failed to notify doctor of new booking: ${err}`);
      }
    }

    return teleconsultation;
  }

  async getMessages(teleconsultationId: string) {
    return this.prisma.teleconsultationMessage.findMany({
      where: { teleconsultationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addMessage(
    teleconsultationId: string,
    senderId: string,
    senderRole: string,
    content: string,
    fileData?: { fileUrl?: string; fileName?: string; fileType?: string; fileSizeBytes?: number },
  ) {
    return this.prisma.teleconsultationMessage.create({
      data: {
        teleconsultationId,
        senderId,
        senderRole: senderRole as any,
        content,
        ...(fileData?.fileUrl ? {
          fileUrl: fileData.fileUrl,
          fileName: fileData.fileName,
          fileType: fileData.fileType,
          fileSizeBytes: fileData.fileSizeBytes,
        } : {}),
      },
    });
  }

  async findById(id: string) {
    const consultation = await this.prisma.teleconsultation.findUnique({
      where: { id },
      include: {
        patient: {
          include: { user: { select: { email: true } } },
        },
        doctor: {
          include: { user: { select: { email: true } } },
        },
      },
    });
    if (!consultation) throw new NotFoundException('Teleconsultation not found');

    return {
      ...consultation,
      patientName: consultation.patient
        ? `${consultation.patient.firstName || ''} ${consultation.patient.lastName || ''}`.trim() || consultation.patient.user?.email
        : null,
      patientEmail: consultation.patient?.user?.email || null,
      doctorName: consultation.doctor
        ? `Dr. ${consultation.doctor.firstName || ''} ${consultation.doctor.lastName || ''}`.trim()
        : null,
      doctorEmail: consultation.doctor?.user?.email || null,
      motif: consultation.reason,
    };
  }

  async uploadChatFile(teleconsultationId: string, file: Express.Multer.File) {
    const consultation = await this.prisma.teleconsultation.findUnique({ where: { id: teleconsultationId } });
    if (!consultation) throw new NotFoundException('Teleconsultation not found');

    const ext = file.originalname.split('.').pop() || 'bin';
    const fileName = `chat-files/${teleconsultationId}/${uuidv4()}.${ext}`;

    const fileUrl = await this.storageService.uploadFile(fileName, file.buffer, file.mimetype);

    return {
      fileUrl,
      fileName: file.originalname,
      fileType: file.mimetype,
      fileSizeBytes: file.size,
    };
  }

  // ==================== INCOMING CALL GLOBAL NOTIFICATION ====================

  /**
   * Send an incoming call notification to the other party via the emergency (global) socket.
   * This ensures the user receives the notification regardless of which page they are on.
   */
  async notifyIncomingCallGlobal(teleconsultationId: string, callerUserId: string) {
    try {
      const consultation = await this.prisma.teleconsultation.findUnique({
        where: { id: teleconsultationId },
        include: {
          doctor: { include: { user: { select: { id: true, role: true } } } },
          patient: { include: { user: { select: { id: true, role: true } } } },
        },
      });

      if (!consultation) return;

      const doctorUserId = consultation.doctor?.userId;
      const patientUserId = consultation.patient?.userId;

      // Determine who is calling and who should receive the notification
      // Use actual DB role (MEDECIN/CARDIOLOGUE) instead of hardcoded values
      const doctorActualRole = consultation.doctor?.user?.role || 'MEDECIN';
      const patientActualRole = consultation.patient?.user?.role || 'PATIENT';

      if (callerUserId === doctorUserId && patientUserId) {
        // Doctor is calling → notify patient
        const callerName = consultation.doctor
          ? `Dr. ${consultation.doctor.firstName || ''} ${consultation.doctor.lastName || ''}`.trim()
          : 'Votre medecin';

        this.emergencyGateway.notifyIncomingCall(patientUserId, patientActualRole, {
          teleconsultationId,
          callerName,
          callerRole: doctorActualRole,
          callerId: callerUserId,
        });
      } else if (callerUserId === patientUserId && doctorUserId) {
        // Patient is calling → notify doctor
        const callerName = consultation.patient
          ? `${consultation.patient.firstName || ''} ${consultation.patient.lastName || ''}`.trim() || 'Un patient'
          : 'Un patient';

        this.emergencyGateway.notifyIncomingCall(doctorUserId, doctorActualRole, {
          teleconsultationId,
          callerName,
          callerRole: patientActualRole,
          callerId: callerUserId,
        });
      } else {
        this.logger.warn(
          `notifyIncomingCallGlobal: callerUserId ${callerUserId} does not match doctor (${doctorUserId}) or patient (${patientUserId}) for teleconsultation ${teleconsultationId}`,
        );
      }
    } catch (err) {
      this.logger.warn(`Failed to send global incoming call notification: ${err}`);
    }
  }

  /**
   * Send a call cancelled notification to the other party via the emergency (global) socket.
   */
  async notifyCallCancelledGlobal(teleconsultationId: string, cancellerUserId: string, reason: string) {
    try {
      const consultation = await this.prisma.teleconsultation.findUnique({
        where: { id: teleconsultationId },
        include: {
          doctor: { include: { user: { select: { id: true, role: true } } } },
          patient: { include: { user: { select: { id: true, role: true } } } },
        },
      });

      if (!consultation) return;

      const doctorUserId = consultation.doctor?.userId;
      const patientUserId = consultation.patient?.userId;

      // Use actual DB roles for correct room targeting
      const doctorActualRole = consultation.doctor?.user?.role || 'MEDECIN';
      const patientActualRole = consultation.patient?.user?.role || 'PATIENT';

      // Notify the other party that the call was cancelled
      if (cancellerUserId === doctorUserId && patientUserId) {
        this.emergencyGateway.notifyCallCancelled(patientUserId, patientActualRole, {
          teleconsultationId,
          reason,
        });
      } else if (cancellerUserId === patientUserId && doctorUserId) {
        this.emergencyGateway.notifyCallCancelled(doctorUserId, doctorActualRole, {
          teleconsultationId,
          reason,
        });
      } else if (cancellerUserId === 'system') {
        // Timeout — notify both parties
        if (patientUserId) {
          this.emergencyGateway.notifyCallCancelled(patientUserId, patientActualRole, { teleconsultationId, reason });
        }
        if (doctorUserId) {
          this.emergencyGateway.notifyCallCancelled(doctorUserId, doctorActualRole, { teleconsultationId, reason });
        }
      } else {
        this.logger.warn(
          `notifyCallCancelledGlobal: cancellerUserId ${cancellerUserId} does not match doctor (${doctorUserId}) or patient (${patientUserId}) for teleconsultation ${teleconsultationId}`,
        );
      }
    } catch (err) {
      this.logger.warn(`Failed to send call cancelled notification: ${err}`);
    }
  }

  // ==================== MISSED CALL NOTIFICATION ====================

  async handleMissedCallCheck(
    teleconsultationId: string,
    callerUserId: string,
    roomParticipantUserIds: string[],
  ) {
    try {
      const consultation = await this.prisma.teleconsultation.findUnique({
        where: { id: teleconsultationId },
        include: {
          doctor: { include: { user: { select: { id: true } } } },
          patient: true,
        },
      });

      if (!consultation?.doctor) return;

      const doctorUserId = consultation.doctor.userId;

      // If doctor is already in the room, no missed call
      if (roomParticipantUserIds.includes(doctorUserId)) return;

      // Only send missed-call if the caller is the patient
      if (callerUserId === doctorUserId) return;

      const patientName = consultation.patient
        ? `${consultation.patient.firstName || ''} ${consultation.patient.lastName || ''}`.trim() || 'Un patient'
        : 'Un patient';

      await this.prisma.alert.create({
        data: {
          patientId: consultation.patientId,
          doctorId: consultation.doctor.id,
          type: 'SYSTEM',
          title: 'Appel manque - Teleconsultation',
          message: `${patientName} essaie de vous appeler en teleconsultation.`,
          severity: 'MODERE',
          metadata: { teleconsultationId },
        },
      });

      this.emergencyGateway.notifyDoctor(doctorUserId, {
        type: 'missed_call',
        teleconsultationId,
        patientName,
        message: `${patientName} essaie de vous appeler.`,
      });

      this.logger.log(`Missed call notification sent for teleconsultation ${teleconsultationId}`);
    } catch (err) {
      this.logger.warn(`Failed to handle missed call check: ${err}`);
    }
  }

  // ─── Doctor Reviews ───

  async submitReview(
    userId: string,
    teleconsultationId: string,
    rating: number,
    comment?: string,
  ) {
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('La note doit etre entre 1 et 5');
    }

    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) throw new NotFoundException('Patient non trouve');

    const consultation = await this.prisma.teleconsultation.findUnique({
      where: { id: teleconsultationId },
      include: { review: true },
    });

    if (!consultation) throw new NotFoundException('Teleconsultation non trouvee');
    if (consultation.status !== 'ENDED') {
      throw new BadRequestException('La teleconsultation doit etre terminee pour laisser un avis');
    }
    if (consultation.patientId !== patient.id) {
      throw new BadRequestException('Vous ne pouvez noter que vos propres teleconsultations');
    }
    if (consultation.review) {
      throw new BadRequestException('Vous avez deja note cette teleconsultation');
    }
    if (!consultation.doctorId) {
      throw new BadRequestException('Aucun medecin associe a cette teleconsultation');
    }

    return this.prisma.$transaction(async (tx) => {
      const review = await tx.doctorReview.create({
        data: {
          doctorId: consultation.doctorId!,
          patientId: patient.id,
          teleconsultationId,
          rating,
          comment: comment?.trim() || null,
        },
      });

      // Recalculate doctor average rating
      const doctor = await tx.doctor.findUnique({
        where: { id: consultation.doctorId! },
        select: { averageRating: true, totalRatings: true },
      });

      const oldCount = doctor!.totalRatings;
      const oldAvg = doctor!.averageRating;
      const newCount = oldCount + 1;
      const newAvg = (oldAvg * oldCount + rating) / newCount;

      await tx.doctor.update({
        where: { id: consultation.doctorId! },
        data: {
          averageRating: Math.round(newAvg * 100) / 100,
          totalRatings: newCount,
        },
      });

      this.logger.log(
        `Review submitted: tc=${teleconsultationId}, rating=${rating}, doctor avg=${newAvg.toFixed(2)}`,
      );

      return review;
    });
  }

  async getDoctorReviews(doctorId: string, page = 1, limit = 20) {
    const [reviews, total] = await Promise.all([
      this.prisma.doctorReview.findMany({
        where: { doctorId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          patient: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.doctorReview.count({ where: { doctorId } }),
    ]);

    return {
      data: reviews,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

}
