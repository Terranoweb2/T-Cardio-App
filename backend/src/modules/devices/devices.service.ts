import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { SyncDataDto } from './dto/sync-data.dto';
import { MeasurementContext } from '@prisma/client';

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==================== REGISTER DEVICE ====================

  async register(patientId: string, dto: RegisterDeviceDto) {
    return this.prisma.connectedDevice.create({
      data: {
        patientId,
        type: dto.type,
        name: dto.name,
        deviceId: dto.deviceId,
        syncConfig: dto.syncConfig ?? undefined,
      },
    });
  }

  // ==================== LIST DEVICES ====================

  async getDevices(patientId: string) {
    const devices = await this.prisma.connectedDevice.findMany({
      where: { patientId, isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        syncLogs: {
          orderBy: { syncedAt: 'desc' },
          take: 1,
        },
      },
    });

    return devices.map((device) => ({
      id: device.id,
      type: device.type,
      name: device.name,
      deviceId: device.deviceId,
      isActive: device.isActive,
      lastSyncAt: device.lastSyncAt,
      syncConfig: device.syncConfig,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
      lastSync: device.syncLogs[0] ?? null,
    }));
  }

  // ==================== REMOVE DEVICE (soft delete) ====================

  async removeDevice(patientId: string, deviceId: string) {
    const device = await this.prisma.connectedDevice.findUnique({
      where: { id: deviceId },
    });

    if (!device || device.patientId !== patientId) {
      throw new NotFoundException('Appareil introuvable');
    }

    await this.prisma.connectedDevice.update({
      where: { id: deviceId },
      data: { isActive: false },
    });

    return { message: 'Appareil deconnecte avec succes' };
  }

  // ==================== SYNC DATA ====================

  async syncData(patientId: string, deviceId: string, dto: SyncDataDto) {
    // 1. Verify device belongs to patient and is active
    const device = await this.prisma.connectedDevice.findUnique({
      where: { id: deviceId },
    });

    if (!device || device.patientId !== patientId) {
      throw new NotFoundException('Appareil introuvable');
    }

    if (!device.isActive) {
      throw new BadRequestException('Cet appareil est desactive');
    }

    let imported = 0;
    let skipped = 0;
    const total = dto.records.length;

    // 2. Process each record
    for (const record of dto.records) {
      const measuredAt = new Date(record.measuredAt);

      // Check for duplicates: same patient, systolic, diastolic, measuredAt
      const existing = await this.prisma.bpMeasurement.findFirst({
        where: {
          patientId,
          systolic: record.systolic,
          diastolic: record.diastolic,
          measuredAt,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Resolve context
      const context = this.resolveContext(record.context);

      await this.prisma.bpMeasurement.create({
        data: {
          patientId,
          systolic: record.systolic,
          diastolic: record.diastolic,
          pulse: record.pulse,
          source: 'BLUETOOTH',
          context,
          measuredAt,
        },
      });

      imported++;
    }

    // 3. Update device lastSyncAt
    await this.prisma.connectedDevice.update({
      where: { id: deviceId },
      data: { lastSyncAt: new Date() },
    });

    // 4. Create sync log
    await this.prisma.deviceSyncLog.create({
      data: {
        connectedDeviceId: deviceId,
        recordsImported: imported,
      },
    });

    this.logger.log(
      `Sync completed for device ${deviceId}: ${imported} imported, ${skipped} skipped out of ${total}`,
    );

    return { imported, skipped, total };
  }

  // ==================== SYNC HISTORY ====================

  async getSyncHistory(patientId: string, deviceId: string) {
    const device = await this.prisma.connectedDevice.findUnique({
      where: { id: deviceId },
    });

    if (!device || device.patientId !== patientId) {
      throw new NotFoundException('Appareil introuvable');
    }

    return this.prisma.deviceSyncLog.findMany({
      where: { connectedDeviceId: deviceId },
      orderBy: { syncedAt: 'desc' },
      take: 20,
    });
  }

  // ==================== HELPERS ====================

  private resolveContext(context?: string): MeasurementContext {
    if (!context) return 'INCONNU';

    const upper = context.toUpperCase();
    const validContexts: MeasurementContext[] = [
      'REPOS',
      'APRES_EFFORT',
      'MATIN',
      'SOIR',
      'STRESS',
      'INCONNU',
    ];

    if (validContexts.includes(upper as MeasurementContext)) {
      return upper as MeasurementContext;
    }

    return 'INCONNU';
  }
}
