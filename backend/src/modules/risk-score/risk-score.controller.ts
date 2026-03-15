import {
  Controller,
  Post,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { RiskScoreService } from './risk-score.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/guards/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@ApiTags('Risk Score')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('risk-score')
export class RiskScoreController {
  constructor(
    private readonly riskScoreService: RiskScoreService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Resolve the patientId for the current user.
   * For PATIENT role: always use their own patientId.
   * For MEDECIN / CARDIOLOGUE: use the provided patientId query param,
   * or fall back to their own if they happen to also be a patient (unlikely).
   */
  private async resolvePatientId(
    userId: string,
    userRole: string,
    queryPatientId?: string,
  ): Promise<string> {
    // Doctors / cardiologists may specify a target patient
    if (
      (userRole === 'MEDECIN' || userRole === 'CARDIOLOGUE' || userRole === 'ADMIN') &&
      queryPatientId
    ) {
      return queryPatientId;
    }

    // Otherwise resolve from the user's own patient profile
    const patient = await this.prisma.patient.findUnique({
      where: { userId },
    });

    if (!patient) {
      throw new Error('Profil patient introuvable pour cet utilisateur.');
    }

    return patient.id;
  }

  // ----------------------------------------------------------------
  // POST /risk-score/calculate
  // ----------------------------------------------------------------

  @Post('calculate')
  @Roles('PATIENT', 'MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({
    summary: 'Calculer le score de risque cardiovasculaire',
    description:
      'Calcule le score de Framingham a partir du profil patient et de ses dernieres mesures de pression arterielle.',
  })
  @ApiQuery({
    name: 'patientId',
    required: false,
    description: 'ID du patient (pour medecins/cardiologues uniquement)',
  })
  async calculate(
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') userRole: string,
    @Query('patientId') queryPatientId?: string,
  ) {
    const patientId = await this.resolvePatientId(userId, userRole, queryPatientId);
    return this.riskScoreService.calculate(patientId);
  }

  // ----------------------------------------------------------------
  // GET /risk-score/latest
  // ----------------------------------------------------------------

  @Get('latest')
  @Roles('PATIENT', 'MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({
    summary: 'Dernier score de risque cardiovasculaire',
    description:
      'Retourne le dernier score de risque calcule pour le patient.',
  })
  @ApiQuery({
    name: 'patientId',
    required: false,
    description: 'ID du patient (pour medecins/cardiologues uniquement)',
  })
  async getLatest(
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') userRole: string,
    @Query('patientId') queryPatientId?: string,
  ) {
    const patientId = await this.resolvePatientId(userId, userRole, queryPatientId);
    return this.riskScoreService.getLatest(patientId);
  }

  // ----------------------------------------------------------------
  // GET /risk-score/history
  // ----------------------------------------------------------------

  @Get('history')
  @Roles('PATIENT', 'MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({
    summary: 'Historique des scores de risque cardiovasculaire',
    description:
      'Retourne l\'historique des scores de risque calcules pour le patient.',
  })
  @ApiQuery({
    name: 'patientId',
    required: false,
    description: 'ID du patient (pour medecins/cardiologues uniquement)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Nombre maximum de resultats (defaut: 10)',
    type: Number,
  })
  async getHistory(
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') userRole: string,
    @Query('patientId') queryPatientId?: string,
    @Query('limit') limit?: string,
  ) {
    const patientId = await this.resolvePatientId(userId, userRole, queryPatientId);
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.riskScoreService.getHistory(patientId, parsedLimit);
  }
}
