import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { PushService } from '../../core/push/push.service';
import { BookAppointmentDto } from './dto/book-appointment.dto';
import { AppointmentStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
  ) {}

  // ==================== BOOK ====================

  async book(patientId: string, dto: BookAppointmentDto) {
    // 1. Get doctor
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: dto.doctorId },
      include: { user: { select: { id: true } } },
    });
    if (!doctor) {
      throw new NotFoundException('Medecin non trouve');
    }

    // 2. Validate scheduledAt is in the future
    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt <= new Date()) {
      throw new BadRequestException('La date du rendez-vous doit etre dans le futur');
    }

    const durationMin = dto.durationMin ?? 30;

    // 3. Check doctor availability for that day of week and time slot
    const dayOfWeek = scheduledAt.getUTCDay(); // 0=Sunday ... 6=Saturday
    const slotTime = `${String(scheduledAt.getUTCHours()).padStart(2, '0')}:${String(scheduledAt.getUTCMinutes()).padStart(2, '0')}`;
    const slotEndMinutes = scheduledAt.getUTCHours() * 60 + scheduledAt.getUTCMinutes() + durationMin;
    const slotEndTime = `${String(Math.floor(slotEndMinutes / 60)).padStart(2, '0')}:${String(slotEndMinutes % 60).padStart(2, '0')}`;

    const availabilities = await this.prisma.doctorAvailability.findMany({
      where: {
        doctorId: doctor.id,
        dayOfWeek,
        isActive: true,
      },
    });

    const isWithinAvailability = availabilities.some(
      (a) => slotTime >= a.startTime && slotEndTime <= a.endTime,
    );

    if (!isWithinAvailability) {
      throw new BadRequestException(
        'Le medecin n\'est pas disponible a cet horaire',
      );
    }

    // 4. Check no DoctorUnavailability for that date
    const dateOnly = new Date(
      Date.UTC(scheduledAt.getUTCFullYear(), scheduledAt.getUTCMonth(), scheduledAt.getUTCDate()),
    );

    const unavailability = await this.prisma.doctorUnavailability.findFirst({
      where: { doctorId: doctor.id, date: dateOnly },
    });

    if (unavailability) {
      // Full day unavailability
      if (!unavailability.startTime) {
        throw new BadRequestException(
          'Le medecin est indisponible a cette date',
        );
      }
      // Partial day unavailability — check overlap
      if (
        unavailability.startTime &&
        unavailability.endTime &&
        slotTime < unavailability.endTime &&
        slotEndTime > unavailability.startTime
      ) {
        throw new BadRequestException(
          'Le medecin est indisponible sur ce creneau',
        );
      }
    }

    // 5. Check no existing Appointment at that time for this doctor (conflict check)
    await this.checkAppointmentConflict(doctor.id, scheduledAt, durationMin);

    // Also check Teleconsultation conflicts
    await this.checkTeleconsultationConflict(doctor.id, scheduledAt, durationMin);

    // 6. Create Appointment with status APPT_PENDING
    const appointment = await this.prisma.appointment.create({
      data: {
        patientId,
        doctorId: doctor.id,
        scheduledAt,
        durationMin,
        status: 'APPT_PENDING',
        reason: dto.reason || null,
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        doctor: { select: { id: true, firstName: true, lastName: true, specialty: true } },
      },
    });

    // 7. Send push notification to doctor
    if (doctor.user?.id) {
      this.pushService
        .sendPush(doctor.user.id, {
          title: 'Nouvelle demande de rendez-vous',
          body: `Un patient souhaite prendre rendez-vous le ${scheduledAt.toLocaleString('fr-FR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}`,
          icon: '/logo-T-Cardio.png',
          tag: `appointment-${appointment.id}`,
          data: { type: 'appointment_request', appointmentId: appointment.id },
        })
        .catch((err) => this.logger.warn(`Push echoue pour medecin: ${err.message}`));
    }

    return appointment;
  }

  // ==================== CONFIRM ====================

  async confirm(doctorUserId: string, appointmentId: string) {
    const appointment = await this.findAppointmentWithOwnershipCheck(
      appointmentId,
      doctorUserId,
      'doctor',
    );

    if (appointment.status !== 'APPT_PENDING') {
      throw new BadRequestException(
        'Seul un rendez-vous en attente peut etre confirme',
      );
    }

    // Create a Teleconsultation with status PLANNED and link it
    const teleconsultation = await this.prisma.teleconsultation.create({
      data: {
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        scheduledAt: appointment.scheduledAt,
        durationMinutes: appointment.durationMin,
        reason: appointment.reason,
        status: 'PLANNED',
        rtcRoomId: uuidv4(),
      },
    });

    // Update appointment status to CONFIRMED and link teleconsultation
    const updated = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'CONFIRMED',
        teleconsultationId: teleconsultation.id,
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, userId: true } },
        doctor: { select: { id: true, firstName: true, lastName: true, specialty: true } },
        teleconsultation: true,
      },
    });

    // Send push to patient
    if (updated.patient?.userId) {
      const doctorName = `Dr. ${updated.doctor.firstName || ''} ${updated.doctor.lastName || ''}`.trim();
      this.pushService
        .sendPush(updated.patient.userId, {
          title: 'Rendez-vous confirme',
          body: `Votre rendez-vous avec ${doctorName} a ete confirme`,
          icon: '/logo-T-Cardio.png',
          tag: `appointment-confirmed-${appointmentId}`,
          data: { type: 'appointment_confirmed', appointmentId },
        })
        .catch((err) => this.logger.warn(`Push echoue pour patient: ${err.message}`));
    }

    return updated;
  }

  // ==================== REJECT ====================

  async reject(doctorUserId: string, appointmentId: string, reason?: string) {
    const appointment = await this.findAppointmentWithOwnershipCheck(
      appointmentId,
      doctorUserId,
      'doctor',
    );

    if (appointment.status !== 'APPT_PENDING') {
      throw new BadRequestException(
        'Seul un rendez-vous en attente peut etre refuse',
      );
    }

    const updated = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'REJECTED',
        doctorNote: reason || null,
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, userId: true } },
        doctor: { select: { id: true, firstName: true, lastName: true, specialty: true } },
      },
    });

    // Send push to patient
    if (updated.patient?.userId) {
      const doctorName = `Dr. ${updated.doctor.firstName || ''} ${updated.doctor.lastName || ''}`.trim();
      this.pushService
        .sendPush(updated.patient.userId, {
          title: 'Demande de rendez-vous refusee',
          body: `Votre demande de rendez-vous avec ${doctorName} a ete refusee${reason ? ': ' + reason : ''}`,
          icon: '/logo-T-Cardio.png',
          tag: `appointment-rejected-${appointmentId}`,
          data: { type: 'appointment_rejected', appointmentId },
        })
        .catch((err) => this.logger.warn(`Push echoue pour patient: ${err.message}`));
    }

    return updated;
  }

  // ==================== CANCEL ====================

  async cancel(userId: string, appointmentId: string, reason?: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        doctor: { select: { id: true, firstName: true, lastName: true, userId: true } },
        patient: { select: { id: true, firstName: true, lastName: true, userId: true } },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Rendez-vous non trouve');
    }

    // Verify user is either the doctor or the patient
    const isDoctor = appointment.doctor?.userId === userId;
    const isPatient = appointment.patient?.userId === userId;

    if (!isDoctor && !isPatient) {
      throw new ForbiddenException('Vous n\'etes pas autorise a annuler ce rendez-vous');
    }

    if (appointment.status === 'CANCELLED' || appointment.status === 'COMPLETED') {
      throw new BadRequestException(
        'Ce rendez-vous ne peut plus etre annule',
      );
    }

    const cancelledBy = isDoctor ? 'DOCTOR' : 'PATIENT';

    const updated = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'CANCELLED',
        cancelledBy,
        cancelReason: reason || null,
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, userId: true } },
        doctor: { select: { id: true, firstName: true, lastName: true, specialty: true, userId: true } },
      },
    });

    // Notify the other party
    if (isDoctor && updated.patient?.userId) {
      const doctorName = `Dr. ${updated.doctor.firstName || ''} ${updated.doctor.lastName || ''}`.trim();
      this.pushService
        .sendPush(updated.patient.userId, {
          title: 'Rendez-vous annule',
          body: `Votre rendez-vous avec ${doctorName} a ete annule${reason ? ': ' + reason : ''}`,
          icon: '/logo-T-Cardio.png',
          tag: `appointment-cancelled-${appointmentId}`,
          data: { type: 'appointment_cancelled', appointmentId },
        })
        .catch((err) => this.logger.warn(`Push echoue pour patient: ${err.message}`));
    } else if (isPatient && updated.doctor?.userId) {
      const patientName = `${updated.patient.firstName || ''} ${updated.patient.lastName || ''}`.trim() || 'Un patient';
      this.pushService
        .sendPush(updated.doctor.userId, {
          title: 'Rendez-vous annule',
          body: `${patientName} a annule son rendez-vous${reason ? ': ' + reason : ''}`,
          icon: '/logo-T-Cardio.png',
          tag: `appointment-cancelled-${appointmentId}`,
          data: { type: 'appointment_cancelled', appointmentId },
        })
        .catch((err) => this.logger.warn(`Push echoue pour medecin: ${err.message}`));
    }

    return updated;
  }

  // ==================== GET PATIENT APPOINTMENTS ====================

  async getPatientAppointments(patientId: string, status?: AppointmentStatus) {
    const where: any = { patientId };
    if (status) {
      where.status = status;
    }

    return this.prisma.appointment.findMany({
      where,
      orderBy: { scheduledAt: 'desc' },
      include: {
        doctor: {
          select: { id: true, firstName: true, lastName: true, specialty: true },
        },
        teleconsultation: {
          select: { id: true, status: true, rtcRoomId: true },
        },
      },
    });
  }

  // ==================== GET DOCTOR APPOINTMENTS ====================

  async getDoctorAppointments(doctorUserId: string, status?: AppointmentStatus) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { userId: doctorUserId },
    });
    if (!doctor) {
      throw new NotFoundException('Profil medecin non trouve');
    }

    const where: any = { doctorId: doctor.id };
    if (status) {
      where.status = status;
    }

    return this.prisma.appointment.findMany({
      where,
      orderBy: { scheduledAt: 'desc' },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true },
        },
        teleconsultation: {
          select: { id: true, status: true, rtcRoomId: true },
        },
      },
    });
  }

  // ==================== PRIVATE HELPERS ====================

  private async findAppointmentWithOwnershipCheck(
    appointmentId: string,
    doctorUserId: string,
    role: 'doctor',
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        doctor: { select: { id: true, userId: true, firstName: true, lastName: true } },
        patient: { select: { id: true, userId: true, firstName: true, lastName: true } },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Rendez-vous non trouve');
    }

    if (appointment.doctor?.userId !== doctorUserId) {
      throw new ForbiddenException('Vous n\'etes pas le medecin de ce rendez-vous');
    }

    return appointment;
  }

  private async checkAppointmentConflict(
    doctorId: string,
    scheduledAt: Date,
    durationMin: number,
  ) {
    const slotStart = scheduledAt.getTime();
    const slotEnd = slotStart + durationMin * 60 * 1000;

    const dayStart = new Date(scheduledAt);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(scheduledAt);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const existing = await this.prisma.appointment.findMany({
      where: {
        doctorId,
        status: { in: ['APPT_PENDING', 'CONFIRMED'] },
        scheduledAt: { gte: dayStart, lte: dayEnd },
      },
      select: { scheduledAt: true, durationMin: true },
    });

    for (const appt of existing) {
      const aStart = new Date(appt.scheduledAt).getTime();
      const aEnd = aStart + (appt.durationMin || 30) * 60 * 1000;
      if (slotStart < aEnd && slotEnd > aStart) {
        throw new BadRequestException(
          'Ce creneau est deja reserve. Veuillez choisir un autre horaire.',
        );
      }
    }
  }

  private async checkTeleconsultationConflict(
    doctorId: string,
    scheduledAt: Date,
    durationMin: number,
  ) {
    const slotStart = scheduledAt.getTime();
    const slotEnd = slotStart + durationMin * 60 * 1000;

    const dayStart = new Date(scheduledAt);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(scheduledAt);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const existing = await this.prisma.teleconsultation.findMany({
      where: {
        doctorId,
        status: { in: ['PLANNED', 'ACTIVE'] },
        scheduledAt: { gte: dayStart, lte: dayEnd },
      },
      select: { scheduledAt: true, durationMinutes: true },
    });

    for (const tc of existing) {
      if (!tc.scheduledAt) continue;
      const cStart = new Date(tc.scheduledAt).getTime();
      const cEnd = cStart + (tc.durationMinutes || 15) * 60 * 1000;
      if (slotStart < cEnd && slotEnd > cStart) {
        throw new BadRequestException(
          'Ce creneau est deja reserve pour une teleconsultation. Veuillez choisir un autre horaire.',
        );
      }
    }
  }
}
