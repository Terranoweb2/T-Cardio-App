import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuditService } from '../../core/audit/audit.service';

@Injectable()
export class EmergencyService {
  private readonly logger = new Logger(EmergencyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async handleEmergencyMeasurement(measurementId: string, patientId: string, systolic: number, diastolic: number) {
    this.logger.warn(`URGENCE: Patient ${patientId} - ${systolic}/${diastolic} mmHg`);

    // Determine trigger type
    const triggerType = systolic >= 180 ? 'SEUIL_SYSTOLIQUE' : 'SEUIL_DIASTOLIQUE';

    // Create emergency event
    const event = await this.prisma.emergencyEvent.create({
      data: {
        patientId,
        measurementId,
        triggerType: triggerType as any,
        triggerValue: { systolic, diastolic },
        status: 'ACTIVE',
        patientNotifiedAt: new Date(),
      },
    });

    // Create alert for patient
    await this.prisma.alert.create({
      data: {
        patientId,
        type: 'EMERGENCY',
        title: 'Alerte tension critique',
        message: `Votre mesure de ${systolic}/${diastolic} mmHg est tres elevee. Contactez votre medecin ou les urgences si vous ressentez des symptomes.`,
        severity: 'CRITIQUE',
      },
    });

    // Notify assigned doctors
    const doctorLinks = await this.prisma.patientDoctorLink.findMany({
      where: { patientId, status: 'ACTIVE' },
      include: { doctor: true },
    });

    for (const link of doctorLinks) {
      await this.prisma.alert.create({
        data: {
          patientId,
          doctorId: link.doctorId,
          type: 'EMERGENCY',
          title: 'Alerte urgence patient',
          message: `Patient avec mesure critique: ${systolic}/${diastolic} mmHg. Consultation urgente recommandee.`,
          severity: 'CRITIQUE',
        },
      });

      // Update notification timestamp
      await this.prisma.emergencyEvent.update({
        where: { id: event.id },
        data: { doctorNotifiedAt: new Date() },
      });
    }

    // Audit log
    await this.auditService.log({
      action: 'CREATE',
      resourceType: 'emergency_event',
      resourceId: event.id,
      details: { patientId, systolic, diastolic, triggerType, doctorsNotified: doctorLinks.length },
    });

    return event;
  }

  async getActiveEmergencies(doctorUserId?: string) {
    const where: any = { status: 'ACTIVE' };

    if (doctorUserId) {
      const doctor = await this.prisma.doctor.findUnique({ where: { userId: doctorUserId } });
      if (doctor) {
        const patientIds = await this.prisma.patientDoctorLink.findMany({
          where: { doctorId: doctor.id, status: 'ACTIVE' },
          select: { patientId: true },
        });
        where.patientId = { in: patientIds.map((p) => p.patientId) };
      }
    }

    return this.prisma.emergencyEvent.findMany({
      where,
      include: { patient: true, measurement: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async acknowledgeEmergency(eventId: string, userId: string) {
    return this.prisma.emergencyEvent.update({
      where: { id: eventId },
      data: { status: 'ACKNOWLEDGED', acknowledgedBy: userId, acknowledgedAt: new Date() },
    });
  }

  async resolveEmergency(eventId: string, notes: string) {
    return this.prisma.emergencyEvent.update({
      where: { id: eventId },
      data: { status: 'RESOLVED', resolutionNotes: notes, resolvedAt: new Date() },
    });
  }
}
