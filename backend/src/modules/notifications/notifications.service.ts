import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getForUser(userId: string, limit: number = 20) {
    // Find patient or doctor to get alerts
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    const doctor = await this.prisma.doctor.findUnique({ where: { userId } });

    const where: any = {};
    if (patient) {
      where.patientId = patient.id;
    } else if (doctor) {
      where.doctorId = doctor.id;
    } else {
      // Admin: show all system alerts
      where.type = 'SYSTEM';
    }

    return this.prisma.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        patient: { select: { firstName: true, lastName: true } },
      },
    });
  }

  async markAsRead(alertId: string, userId: string) {
    return this.prisma.alert.update({
      where: { id: alertId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    const doctor = await this.prisma.doctor.findUnique({ where: { userId } });

    const where: any = { isRead: false };
    if (patient) {
      where.patientId = patient.id;
    } else if (doctor) {
      where.doctorId = doctor.id;
    }

    return this.prisma.alert.updateMany({
      where,
      data: { isRead: true, readAt: new Date() },
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    const doctor = await this.prisma.doctor.findUnique({ where: { userId } });

    const where: any = { isRead: false };
    if (patient) {
      where.patientId = patient.id;
    } else if (doctor) {
      where.doctorId = doctor.id;
    }

    return this.prisma.alert.count({ where });
  }
}
