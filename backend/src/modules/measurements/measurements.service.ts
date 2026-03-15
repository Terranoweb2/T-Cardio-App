import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateMeasurementDto } from './dto/create-measurement.dto';
import { QueryMeasurementDto } from './dto/query-measurement.dto';
import { RiskLevel } from '@prisma/client';
import { VisionOcrService } from '../ai-engine/vision-ocr.service';
import { StorageService } from '../storage/storage.service';
import { EmergencyService } from '../emergency/emergency.service';
import { GamificationService } from '../gamification/gamification.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MeasurementsService {
  private readonly logger = new Logger(MeasurementsService.name);

  // In-memory cache for AI thresholds
  private cachedThresholds: any[] | null = null;
  private cacheTimestamp = 0;
  private readonly CACHE_TTL = 60_000; // 1 minute

  constructor(
    private readonly prisma: PrismaService,
    private readonly visionOcr: VisionOcrService,
    private readonly storageService: StorageService,
    private readonly emergencyService: EmergencyService,
    private readonly gamificationService: GamificationService,
  ) {}

  async create(userId: string, dto: CreateMeasurementDto) {
    // Get patient
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) throw new BadRequestException('Patient profile required');

    // Validate systolic > diastolic
    if (dto.systolic <= dto.diastolic) {
      throw new BadRequestException('Systolic must be greater than diastolic');
    }

    // Prevent duplicate save from the same scanned/uploaded photo
    if (dto.photoPath) {
      const existing = await this.prisma.bpMeasurement.findFirst({
        where: { patientId: patient.id, photoPath: dto.photoPath },
      });
      if (existing) {
        throw new BadRequestException('Cette mesure scannee a deja ete enregistree. Veuillez scanner une nouvelle photo.');
      }
    }

    // Calculate risk level using DB-configured thresholds
    const riskLevel = await this.calculateRiskLevel(dto.systolic, dto.diastolic);
    const isEmergency = await this.detectEmergency(dto.systolic, dto.diastolic);

    const measurement = await this.prisma.bpMeasurement.create({
      data: {
        patientId: patient.id,
        systolic: dto.systolic,
        diastolic: dto.diastolic,
        pulse: dto.pulse,
        source: dto.source || 'MANUEL',
        context: dto.context || 'INCONNU',
        notes: dto.notes,
        photoPath: dto.photoPath,
        riskLevel,
        isEmergency,
        measuredAt: new Date(dto.measuredAt),
      },
    });

    // Notify all linked doctors about every new measurement
    try {
      const doctorLinks = await this.prisma.patientDoctorLink.findMany({
        where: { patientId: patient.id, status: 'ACTIVE' },
        include: { doctor: true },
      });

      const patientName = `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Patient';

      for (const link of doctorLinks) {
        await this.prisma.alert.create({
          data: {
            patientId: patient.id,
            doctorId: link.doctorId,
            type: isEmergency ? 'EMERGENCY' : 'MEASUREMENT',
            title: isEmergency ? 'Mesure critique recue' : 'Nouvelle mesure recue',
            message: `${patientName}: ${dto.systolic}/${dto.diastolic} mmHg${dto.pulse ? ` (pouls: ${dto.pulse} bpm)` : ''} — Risque: ${riskLevel}`,
            severity: isEmergency ? 'CRITIQUE' : riskLevel === 'ELEVE' ? 'ELEVE' : 'FAIBLE',
          },
        });
      }

      if (doctorLinks.length > 0) {
        this.logger.log(`Measurement notification sent to ${doctorLinks.length} doctor(s) for patient ${patient.id}`);
      }
    } catch (err) {
      this.logger.warn(`Failed to notify doctors about measurement: ${err.message}`);
    }

    // Handle emergency measurements (creates EmergencyEvent + special alerts)
    if (isEmergency) {
      try {
        await this.emergencyService.handleEmergencyMeasurement(
          measurement.id, patient.id, dto.systolic, dto.diastolic,
        );
      } catch (err) {
        this.logger.warn(`Failed to handle emergency measurement: ${err.message}`);
      }
    }

    // Gamification: update streak, award XP and badges
    try {
      await this.gamificationService.onMeasurement(patient.id);
    } catch (err) {
      this.logger.warn(`Failed to update gamification on measurement: ${err.message}`);
    }

    return measurement;
  }

  // ==================== OCR PHOTO ANALYSIS ====================

  async processOcrPhoto(userId: string, photo: Express.Multer.File) {
    // 1. Get patient
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) throw new BadRequestException('Patient profile required');

    // 2. Upload photo to MinIO for doctor review
    const ext = photo.originalname?.split('.').pop() || 'jpg';
    const fileName = `bp-photos/${patient.id}/${uuidv4()}.${ext}`;
    let photoPath: string;

    try {
      photoPath = await this.storageService.uploadFile(fileName, photo.buffer, photo.mimetype);
      this.logger.log(`BP photo uploaded: ${fileName}`);
    } catch (err) {
      this.logger.warn(`Failed to upload BP photo: ${err.message}`);
      photoPath = fileName; // Use path even if upload fails, OCR still works
    }

    // 3. Convert image to base64 for vision API
    const base64Image = photo.buffer.toString('base64');

    // 4. Call vision OCR service
    const ocrResult = await this.visionOcr.extractBpFromImage(base64Image);

    // 5. Return extracted values + photoPath
    return {
      ...ocrResult,
      photoPath,
    };
  }

  // ==================== QUERIES ====================

  async findByPatientUserId(userId: string, query: QueryMeasurementDto) {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) {
      return { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
    }

    return this.findByPatientId(patient.id, query);
  }

  async findByPatientId(patientId: string, query: QueryMeasurementDto) {
    const { days = 30, page = 1, limit = 20 } = query;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [measurements, total] = await Promise.all([
      this.prisma.bpMeasurement.findMany({
        where: { patientId, measuredAt: { gte: since } },
        orderBy: { measuredAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.bpMeasurement.count({
        where: { patientId, measuredAt: { gte: since } },
      }),
    ]);

    return {
      data: measurements,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getStats(patientId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const measurements = await this.prisma.bpMeasurement.findMany({
      where: { patientId, measuredAt: { gte: since } },
      orderBy: { measuredAt: 'asc' },
    });

    if (measurements.length === 0) return null;

    const systolics = measurements.map((m) => m.systolic);
    const diastolics = measurements.map((m) => m.diastolic);
    const pulses = measurements.filter((m) => m.pulse).map((m) => m.pulse!);

    return {
      count: measurements.length,
      period: { days, from: since, to: new Date() },
      systolic: {
        avg: Math.round(systolics.reduce((a, b) => a + b, 0) / systolics.length),
        min: Math.min(...systolics),
        max: Math.max(...systolics),
      },
      diastolic: {
        avg: Math.round(diastolics.reduce((a, b) => a + b, 0) / diastolics.length),
        min: Math.min(...diastolics),
        max: Math.max(...diastolics),
      },
      pulse: pulses.length > 0 ? {
        avg: Math.round(pulses.reduce((a, b) => a + b, 0) / pulses.length),
        min: Math.min(...pulses),
        max: Math.max(...pulses),
      } : null,
      emergencyCount: measurements.filter((m) => m.isEmergency).length,
    };
  }

  async getRecentForAi(patientId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    return this.prisma.bpMeasurement.findMany({
      where: { patientId, measuredAt: { gte: since } },
      orderBy: { measuredAt: 'asc' },
    });
  }

  /**
   * Load active thresholds from DB with in-memory caching (TTL: 1 min).
   */
  private async getActiveThresholds() {
    const now = Date.now();
    if (this.cachedThresholds && now - this.cacheTimestamp < this.CACHE_TTL) {
      return this.cachedThresholds;
    }

    try {
      this.cachedThresholds = await this.prisma.aiThreshold.findMany({
        where: { isActive: true },
        orderBy: { priority: 'desc' },
      });
      this.cacheTimestamp = now;
      this.logger.debug(`Loaded ${this.cachedThresholds.length} active thresholds from DB`);
    } catch (err) {
      this.logger.warn(`Failed to load thresholds from DB: ${err.message}`);
      // Keep stale cache if available
      if (!this.cachedThresholds) {
        this.cachedThresholds = [];
      }
    }

    return this.cachedThresholds;
  }

  /**
   * Calculate risk level using DB-configured thresholds.
   * Falls back to hardcoded values if no thresholds are configured.
   */
  private async calculateRiskLevel(systolic: number, diastolic: number): Promise<RiskLevel> {
    const thresholds = await this.getActiveThresholds();

    // Fallback to hardcoded values if no thresholds configured
    if (!thresholds || thresholds.length === 0) {
      this.logger.warn('No active thresholds found, using hardcoded fallback');
      if (systolic >= 180 || diastolic >= 120) return 'CRITIQUE';
      if (systolic >= 140 || diastolic >= 90) return 'ELEVE';
      if (systolic >= 120 || diastolic >= 80) return 'MODERE';
      return 'FAIBLE';
    }

    // Iterate from highest priority to lowest
    for (const t of thresholds) {
      const sysMatch =
        (t.systolicMin == null || systolic >= t.systolicMin) &&
        (t.systolicMax == null || systolic <= t.systolicMax);

      const diaMatch =
        (t.diastolicMin == null || diastolic >= t.diastolicMin) &&
        (t.diastolicMax == null || diastolic <= t.diastolicMax);

      if (sysMatch || diaMatch) {
        const params = t.actionParams as any;
        if (params?.riskLevel) {
          return params.riskLevel as RiskLevel;
        }
      }
    }

    return 'FAIBLE';
  }

  /**
   * Detect emergency using DB-configured EMERGENCY thresholds.
   * Falls back to hardcoded values if no thresholds are configured.
   */
  private async detectEmergency(systolic: number, diastolic: number): Promise<boolean> {
    const thresholds = await this.getActiveThresholds();

    // Fallback to hardcoded values if no thresholds configured
    if (!thresholds || thresholds.length === 0) {
      return systolic >= 180 || diastolic >= 120;
    }

    const emergencyThresholds = thresholds.filter((t) => t.category === 'EMERGENCY');

    // If no EMERGENCY thresholds configured, fallback
    if (emergencyThresholds.length === 0) {
      return systolic >= 180 || diastolic >= 120;
    }

    for (const t of emergencyThresholds) {
      const sysMatch =
        (t.systolicMin == null || systolic >= t.systolicMin) &&
        (t.systolicMax == null || systolic <= t.systolicMax);

      const diaMatch =
        (t.diastolicMin == null || diastolic >= t.diastolicMin) &&
        (t.diastolicMax == null || diastolic <= t.diastolicMax);

      if (sysMatch || diaMatch) {
        return true;
      }
    }

    return false;
  }
}
