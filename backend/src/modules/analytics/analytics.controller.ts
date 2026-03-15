import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/guards/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly prisma: PrismaService,
  ) {}

  private async getPatientId(userId: string): Promise<string> {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    return patient?.id || '';
  }

  @Get('moving-average')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Moyennes mobiles' })
  async getMyMovingAverage(@CurrentUser('sub') userId: string, @Query('window') window?: number) {
    const patientId = await this.getPatientId(userId);
    return this.analyticsService.getMovingAverage(patientId, window || 7);
  }

  @Get('variability')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Variabilite tensionnelle' })
  async getMyVariability(@CurrentUser('sub') userId: string, @Query('days') days?: number) {
    const patientId = await this.getPatientId(userId);
    return this.analyticsService.getVariability(patientId, days || 30);
  }

  @Get('morning-evening')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Comparaison matin/soir' })
  async getMyMorningEvening(@CurrentUser('sub') userId: string, @Query('days') days?: number) {
    const patientId = await this.getPatientId(userId);
    return this.analyticsService.getMorningEveningComparison(patientId, days || 30);
  }

  @Get('trends')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Tendances' })
  async getMyTrends(@CurrentUser('sub') userId: string, @Query('days') days?: number) {
    const patientId = await this.getPatientId(userId);
    return this.analyticsService.getTrends(patientId, days || 30);
  }

  @Get('chart-data')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Donnees graphiques' })
  async getMyChartData(@CurrentUser('sub') userId: string, @Query('days') days?: number) {
    const patientId = await this.getPatientId(userId);
    return this.analyticsService.getChartData(patientId, days || 30);
  }

  @Get('patient/:patientId/moving-average')
  @Roles('MEDECIN', 'CARDIOLOGUE', 'ADMIN')
  @ApiOperation({ summary: 'Moyennes mobiles patient (medecin)' })
  async getPatientMovingAverage(@Param('patientId') patientId: string, @Query('window') window?: number) {
    return this.analyticsService.getMovingAverage(patientId, window || 7);
  }

  @Get('patient/:patientId/variability')
  @Roles('MEDECIN', 'CARDIOLOGUE', 'ADMIN')
  @ApiOperation({ summary: 'Variabilite patient (medecin)' })
  async getPatientVariability(@Param('patientId') patientId: string, @Query('days') days?: number) {
    return this.analyticsService.getVariability(patientId, days || 30);
  }

  @Get('patient/:patientId/trends')
  @Roles('MEDECIN', 'CARDIOLOGUE', 'ADMIN')
  @ApiOperation({ summary: 'Tendances patient (medecin)' })
  async getPatientTrends(@Param('patientId') patientId: string, @Query('days') days?: number) {
    return this.analyticsService.getTrends(patientId, days || 30);
  }

  @Get('patient/:patientId/chart-data')
  @Roles('MEDECIN', 'CARDIOLOGUE', 'ADMIN')
  @ApiOperation({ summary: 'Donnees graphiques patient (medecin)' })
  async getPatientChartData(@Param('patientId') patientId: string, @Query('days') days?: number) {
    return this.analyticsService.getChartData(patientId, days || 30);
  }
}
