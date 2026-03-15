import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { MedicationsService } from './medications.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { UpdateMedicationDto } from './dto/update-medication.dto';
import { LogMedicationDto } from './dto/log-medication.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/guards/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@ApiTags('Medications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('medications')
export class MedicationsController {
  constructor(
    private readonly medicationsService: MedicationsService,
    private readonly prisma: PrismaService,
  ) {}

  private async getPatientId(userId: string): Promise<string> {
    const patient = await this.prisma.patient.findUnique({
      where: { userId },
    });
    if (!patient) {
      throw new NotFoundException('Profil patient non trouve');
    }
    return patient.id;
  }

  @Post()
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Creer un medicament' })
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateMedicationDto,
  ) {
    const patientId = await this.getPatientId(userId);
    return this.medicationsService.create(patientId, dto);
  }

  @Get()
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Lister mes medicaments' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  async findAll(
    @CurrentUser('sub') userId: string,
    @Query('isActive') isActive?: string,
  ) {
    const patientId = await this.getPatientId(userId);
    const active =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.medicationsService.findAll(patientId, active);
  }

  @Get('today')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Checklist des medicaments du jour' })
  async getTodayChecklist(@CurrentUser('sub') userId: string) {
    const patientId = await this.getPatientId(userId);
    return this.medicationsService.getTodayChecklist(patientId);
  }

  @Get('adherence')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Statistiques d\'adherence aux medicaments' })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Nombre de jours (defaut: 7)',
  })
  async getAdherenceStats(
    @CurrentUser('sub') userId: string,
    @Query('days') days?: string,
  ) {
    const patientId = await this.getPatientId(userId);
    const numDays = days ? parseInt(days, 10) : 7;
    return this.medicationsService.getAdherenceStats(patientId, numDays);
  }

  @Get(':id')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Voir un medicament avec ses logs recents' })
  async findById(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    const patientId = await this.getPatientId(userId);
    return this.medicationsService.findById(patientId, id);
  }

  @Patch(':id')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Modifier un medicament' })
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMedicationDto,
  ) {
    const patientId = await this.getPatientId(userId);
    return this.medicationsService.update(patientId, id, dto);
  }

  @Delete(':id')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Desactiver un medicament (suppression douce)' })
  async delete(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    const patientId = await this.getPatientId(userId);
    return this.medicationsService.delete(patientId, id);
  }

  @Post(':id/log')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Enregistrer une prise de medicament' })
  async logMedication(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: LogMedicationDto,
  ) {
    const patientId = await this.getPatientId(userId);
    // Ensure the medicationId in the DTO matches the route param
    dto.medicationId = id;
    return this.medicationsService.logMedication(patientId, dto);
  }
}
