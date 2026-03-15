import { Controller, Get, Post, Put, Delete, Body, Query, UseGuards, Param, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { MeasurementsService } from './measurements.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateMeasurementDto } from './dto/create-measurement.dto';
import { QueryMeasurementDto } from './dto/query-measurement.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/guards/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@ApiTags('Measurements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('measurements')
export class MeasurementsController {
  constructor(
    private readonly measurementsService: MeasurementsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Ajouter une mesure' })
  async create(@CurrentUser('sub') userId: string, @Body() dto: CreateMeasurementDto) {
    return this.measurementsService.create(userId, dto);
  }

  @Post('ocr')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Analyser une photo de tensiometre (OCR)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo'))
  async ocrTensiometer(
    @CurrentUser('sub') userId: string,
    @UploadedFile() photo: Express.Multer.File,
  ) {
    if (!photo) throw new BadRequestException('Aucune photo fournie');
    if (photo.size > 5 * 1024 * 1024) throw new BadRequestException('Photo trop volumineuse (max 5MB)');

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(photo.mimetype)) {
      throw new BadRequestException('Format non supporte. Utilisez JPEG, PNG ou WebP.');
    }

    return this.measurementsService.processOcrPhoto(userId, photo);
  }

  @Get()
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Mon historique de mesures' })
  async getMyMeasurements(@CurrentUser('sub') userId: string, @Query() query: QueryMeasurementDto) {
    return this.measurementsService.findByPatientUserId(userId, query);
  }

  @Get('stats')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Mes statistiques' })
  async getMyStats(@CurrentUser('sub') userId: string, @Query('days') days?: number) {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) return null;
    return this.measurementsService.getStats(patient.id, days || 30);
  }

  // ===== Measurement Reminders =====

  @Get('reminders')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Mes preferences de rappels' })
  async getReminder(@CurrentUser('sub') userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) return null;
    return this.prisma.measurementReminder.findUnique({ where: { patientId: patient.id } });
  }

  @Put('reminders')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Configurer mes rappels de mesure' })
  async upsertReminder(
    @CurrentUser('sub') userId: string,
    @Body() body: { frequency?: string; preferredTimes?: string[]; channel?: string; enabled?: boolean },
  ) {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) throw new BadRequestException('Patient introuvable');
    return this.prisma.measurementReminder.upsert({
      where: { patientId: patient.id },
      create: {
        patientId: patient.id,
        frequency: (body.frequency as any) || 'ONCE_DAILY',
        preferredTimes: body.preferredTimes || ['08:00'],
        channel: (body.channel as any) || 'BOTH',
        enabled: body.enabled !== false,
      },
      update: {
        ...(body.frequency && { frequency: body.frequency as any }),
        ...(body.preferredTimes && { preferredTimes: body.preferredTimes }),
        ...(body.channel && { channel: body.channel as any }),
        ...(body.enabled !== undefined && { enabled: body.enabled }),
      },
    });
  }

  @Delete('reminders')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Desactiver mes rappels' })
  async deleteReminder(@CurrentUser('sub') userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) return { success: true };
    await this.prisma.measurementReminder.deleteMany({ where: { patientId: patient.id } });
    return { success: true };
  }

  @Get('patient/:patientId')
  @Roles('MEDECIN', 'CARDIOLOGUE', 'ADMIN')
  @ApiOperation({ summary: 'Mesures d\'un patient (medecin)' })
  async getPatientMeasurements(@Param('patientId') patientId: string, @Query() query: QueryMeasurementDto) {
    return this.measurementsService.findByPatientId(patientId, query);
  }

  @Get('patient/:patientId/stats')
  @Roles('MEDECIN', 'CARDIOLOGUE', 'ADMIN')
  @ApiOperation({ summary: 'Stats d\'un patient (medecin)' })
  async getPatientStats(@Param('patientId') patientId: string, @Query('days') days?: number) {
    return this.measurementsService.getStats(patientId, days || 30);
  }
}
