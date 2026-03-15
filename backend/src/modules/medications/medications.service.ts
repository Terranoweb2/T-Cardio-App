import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { UpdateMedicationDto } from './dto/update-medication.dto';
import { LogMedicationDto } from './dto/log-medication.dto';

@Injectable()
export class MedicationsService {
  private readonly logger = new Logger(MedicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gamificationService: GamificationService,
  ) {}

  // ==================== CRUD ====================

  async create(patientId: string, dto: CreateMedicationDto) {
    return this.prisma.medication.create({
      data: {
        patientId,
        name: dto.name,
        dosage: dto.dosage,
        frequency: dto.frequency,
        reminderTimes: dto.reminderTimes,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        notes: dto.notes,
        prescribedBy: dto.prescribedBy,
      },
    });
  }

  async findAll(patientId: string, isActive?: boolean) {
    return this.prisma.medication.findMany({
      where: {
        patientId,
        ...(isActive !== undefined ? { isActive } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(patientId: string, medicationId: string) {
    const medication = await this.prisma.medication.findUnique({
      where: { id: medicationId },
      include: {
        logs: {
          orderBy: { scheduledAt: 'desc' },
          take: 30,
        },
      },
    });

    if (!medication) {
      throw new NotFoundException('Medicament non trouve');
    }

    if (medication.patientId !== patientId) {
      throw new NotFoundException('Medicament non trouve pour ce patient');
    }

    return medication;
  }

  async update(
    patientId: string,
    medicationId: string,
    dto: UpdateMedicationDto,
  ) {
    const medication = await this.prisma.medication.findUnique({
      where: { id: medicationId },
    });

    if (!medication) {
      throw new NotFoundException('Medicament non trouve');
    }

    if (medication.patientId !== patientId) {
      throw new NotFoundException('Medicament non trouve pour ce patient');
    }

    return this.prisma.medication.update({
      where: { id: medicationId },
      data: {
        name: dto.name,
        dosage: dto.dosage,
        frequency: dto.frequency,
        reminderTimes: dto.reminderTimes,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        notes: dto.notes,
        prescribedBy: dto.prescribedBy,
      },
    });
  }

  async delete(patientId: string, medicationId: string) {
    const medication = await this.prisma.medication.findUnique({
      where: { id: medicationId },
    });

    if (!medication) {
      throw new NotFoundException('Medicament non trouve');
    }

    if (medication.patientId !== patientId) {
      throw new NotFoundException('Medicament non trouve pour ce patient');
    }

    return this.prisma.medication.update({
      where: { id: medicationId },
      data: { isActive: false },
    });
  }

  // ==================== LOGGING ====================

  async logMedication(patientId: string, dto: LogMedicationDto) {
    const medication = await this.prisma.medication.findUnique({
      where: { id: dto.medicationId },
    });

    if (!medication) {
      throw new NotFoundException('Medicament non trouve');
    }

    if (medication.patientId !== patientId) {
      throw new BadRequestException(
        'Ce medicament n\'appartient pas a ce patient',
      );
    }

    if (!medication.isActive) {
      throw new BadRequestException('Ce medicament n\'est plus actif');
    }

    const log = await this.prisma.medicationLog.create({
      data: {
        medicationId: dto.medicationId,
        status: dto.status,
        scheduledAt: new Date(dto.scheduledAt),
        takenAt: dto.status === 'TAKEN' ? new Date() : undefined,
        notes: dto.notes,
      },
    });

    // Gamification: award XP and check adherence badges
    try {
      await this.gamificationService.onMedicationLog(patientId);
    } catch (err) {
      this.logger.warn(`Failed to update gamification on medication log: ${err.message}`);
    }

    return log;
  }

  // ==================== TODAY CHECKLIST ====================

  async getTodayChecklist(patientId: string) {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const todayEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );

    // Get all active medications for this patient
    const medications = await this.prisma.medication.findMany({
      where: {
        patientId,
        isActive: true,
        startDate: { lte: todayEnd },
        OR: [{ endDate: null }, { endDate: { gte: todayStart } }],
      },
      include: {
        logs: {
          where: {
            scheduledAt: {
              gte: todayStart,
              lte: todayEnd,
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // For each medication, build the checklist based on reminderTimes
    return medications.map((med) => {
      const expectedEntries = (med.reminderTimes || []).map((time) => {
        const [hours, minutes] = time.split(':').map(Number);
        const scheduledAt = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          hours,
          minutes,
        );

        // Find matching log for this scheduled time (within a 1-minute tolerance)
        const matchingLog = med.logs.find((log) => {
          const logTime = new Date(log.scheduledAt).getTime();
          const expectedTime = scheduledAt.getTime();
          return Math.abs(logTime - expectedTime) < 60 * 1000;
        });

        return {
          reminderTime: time,
          scheduledAt: scheduledAt.toISOString(),
          status: matchingLog ? matchingLog.status : null,
          logId: matchingLog ? matchingLog.id : null,
          takenAt: matchingLog ? matchingLog.takenAt : null,
        };
      });

      return {
        id: med.id,
        name: med.name,
        dosage: med.dosage,
        frequency: med.frequency,
        notes: med.notes,
        entries: expectedEntries,
      };
    });
  }

  // ==================== ADHERENCE STATS ====================

  async getAdherenceStats(patientId: string, days: number = 7) {
    const now = new Date();
    const startDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - days,
    );
    const endDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );

    // Get all active medications for this patient that were active during the period
    const medications = await this.prisma.medication.findMany({
      where: {
        patientId,
        isActive: true,
        startDate: { lte: endDate },
        OR: [{ endDate: null }, { endDate: { gte: startDate } }],
      },
    });

    // Calculate total expected doses over the period
    let totalExpected = 0;
    for (const med of medications) {
      const medStart = new Date(med.startDate) > startDate
        ? new Date(med.startDate)
        : startDate;
      const medEnd = med.endDate && new Date(med.endDate) < endDate
        ? new Date(med.endDate)
        : endDate;

      // Count days the medication was active
      const activeDays = Math.max(
        0,
        Math.ceil(
          (medEnd.getTime() - medStart.getTime()) / (1000 * 60 * 60 * 24),
        ),
      );

      // Expected doses per day = number of reminderTimes
      const dosesPerDay = (med.reminderTimes || []).length;
      totalExpected += activeDays * dosesPerDay;
    }

    // Get actual logs for the period
    const medicationIds = medications.map((m) => m.id);

    const logs = await this.prisma.medicationLog.findMany({
      where: {
        medicationId: { in: medicationIds },
        scheduledAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const taken = logs.filter((l) => l.status === 'TAKEN').length;
    const skipped = logs.filter((l) => l.status === 'SKIPPED').length;
    const missed = logs.filter((l) => l.status === 'MISSED').length;

    const adherencePercent =
      totalExpected > 0
        ? Math.round((taken / totalExpected) * 100 * 10) / 10
        : 0;

    return {
      totalExpected,
      taken,
      skipped,
      missed,
      adherencePercent,
    };
  }
}
