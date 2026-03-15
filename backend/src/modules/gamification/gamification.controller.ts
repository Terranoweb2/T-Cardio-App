import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { GamificationService } from './gamification.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalProgressDto } from './dto/update-goal-progress.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/guards/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@ApiTags('Gamification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('gamification')
export class GamificationController {
  constructor(
    private readonly gamificationService: GamificationService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Resolve the patient ID from the JWT user ID.
   */
  private async resolvePatientId(userId: string): Promise<string> {
    const patient = await this.prisma.patient.findUnique({
      where: { userId },
    });
    if (!patient) {
      throw new BadRequestException('Patient introuvable');
    }
    return patient.id;
  }

  @Get('profile')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Recuperer mon profil XP et niveau' })
  async getProfile(@CurrentUser('sub') userId: string) {
    const patientId = await this.resolvePatientId(userId);
    return this.gamificationService.getProfile(patientId);
  }

  @Get('achievements')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Lister mes badges debloques' })
  async getAchievements(@CurrentUser('sub') userId: string) {
    const patientId = await this.resolvePatientId(userId);
    return this.gamificationService.getAchievements(patientId);
  }

  @Get('badges')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Lister tous les badges disponibles' })
  async getAllBadges() {
    return this.gamificationService.getAllBadges();
  }

  @Get('goals')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Lister mes objectifs de sante' })
  async getGoals(@CurrentUser('sub') userId: string) {
    const patientId = await this.resolvePatientId(userId);
    return this.gamificationService.getGoals(patientId);
  }

  @Post('goals')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Creer un objectif de sante' })
  async createGoal(@CurrentUser('sub') userId: string, @Body() dto: CreateGoalDto) {
    const patientId = await this.resolvePatientId(userId);
    return this.gamificationService.createGoal(patientId, dto);
  }

  @Patch('goals/:id')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Mettre a jour la progression d\'un objectif' })
  async updateGoalProgress(
    @CurrentUser('sub') userId: string,
    @Param('id') goalId: string,
    @Body() dto: UpdateGoalProgressDto,
  ) {
    const patientId = await this.resolvePatientId(userId);
    return this.gamificationService.updateGoalProgress(patientId, goalId, dto.currentValue);
  }

  @Get('leaderboard')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Classement des meilleurs patients par XP' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Nombre de resultats (defaut: 10)' })
  async getLeaderboard(@Query('limit') limit?: number) {
    const parsedLimit = limit ? Math.min(Math.max(Number(limit), 1), 50) : 10;
    return this.gamificationService.getLeaderboard(parsedLimit);
  }
}
