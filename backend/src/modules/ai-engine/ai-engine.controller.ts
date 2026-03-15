import { Controller, Post, Get, Body, UseGuards, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AiEngineService } from './ai-engine.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/guards/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';

@ApiTags('AI')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai')
export class AiEngineController {
  constructor(
    private readonly aiService: AiEngineService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('analyze')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Lancer une analyse IA de mes mesures' })
  async analyzeMyData(
    @CurrentUser('sub') userId: string,
    @Body('days') days: number = 30,
  ) {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) return { error: 'Patient profile required' };

    const since = new Date();
    since.setDate(since.getDate() - days);

    const measurements = await this.prisma.bpMeasurement.findMany({
      where: { patientId: patient.id, measuredAt: { gte: since } },
      orderBy: { measuredAt: 'asc' },
    });

    if (measurements.length === 0) return { error: 'No measurements found' };

    const age = patient.birthDate
      ? Math.floor((Date.now() - new Date(patient.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : undefined;

    return this.aiService.analyzePatientData({
      patientId: patient.id,
      measurements: measurements.map((m) => ({
        systolic: m.systolic,
        diastolic: m.diastolic,
        pulse: m.pulse || undefined,
        date: m.measuredAt.toISOString(),
      })),
      patientContext: {
        age,
        gender: patient.gender || undefined,
        medicalStatus: patient.medicalStatus,
      },
      periodDays: days,
    });
  }

  @Get('latest')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Derniere analyse IA' })
  async getMyLatestAnalysis(@CurrentUser('sub') userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) return null;
    return this.aiService.getLatestAnalysis(patient.id);
  }

  @Post('patient/:patientId/analyze')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Analyser un patient (medecin)' })
  async analyzePatient(@Param('patientId') patientId: string, @Body('days') days: number = 30) {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) return { error: 'Patient not found' };

    const since = new Date();
    since.setDate(since.getDate() - days);

    const measurements = await this.prisma.bpMeasurement.findMany({
      where: { patientId, measuredAt: { gte: since } },
      orderBy: { measuredAt: 'asc' },
    });

    if (measurements.length === 0) return { error: 'No measurements found' };

    const age = patient.birthDate
      ? Math.floor((Date.now() - new Date(patient.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : undefined;

    return this.aiService.analyzePatientData({
      patientId,
      measurements: measurements.map((m) => ({
        systolic: m.systolic,
        diastolic: m.diastolic,
        pulse: m.pulse || undefined,
        date: m.measuredAt.toISOString(),
      })),
      patientContext: {
        age,
        gender: patient.gender || undefined,
        medicalStatus: patient.medicalStatus,
      },
      periodDays: days,
    });
  }

  @Get('patient/:patientId/history')
  @Roles('MEDECIN', 'CARDIOLOGUE', 'ADMIN')
  @ApiOperation({ summary: 'Historique analyses IA patient' })
  async getPatientAnalysisHistory(@Param('patientId') patientId: string, @Query('limit') limit?: number) {
    return this.aiService.getAnalysisHistory(patientId, limit || 10);
  }
}
