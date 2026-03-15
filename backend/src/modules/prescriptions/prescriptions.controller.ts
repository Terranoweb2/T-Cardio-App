import { Controller, Get, Post, Body, Param, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { PrescriptionsService } from './prescriptions.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/guards/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@ApiTags('Prescriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('MEDECIN', 'CARDIOLOGUE', 'ADMIN')
  @ApiOperation({ summary: 'Creer une ordonnance' })
  async create(
    @CurrentUser('sub') userId: string,
    @Body() body: {
      patientId: string;
      teleconsultationId?: string;
      medications: Array<{ name: string; dosage: string; frequency: string; duration: string; notes?: string }>;
      notes?: string;
    },
  ) {
    return this.prescriptionsService.create(userId, body);
  }

  @Get('doctor')
  @UseGuards(RolesGuard)
  @Roles('MEDECIN', 'CARDIOLOGUE', 'ADMIN')
  @ApiOperation({ summary: 'Mes ordonnances (medecin)' })
  async findByDoctor(@CurrentUser('sub') userId: string) {
    return this.prescriptionsService.findByDoctor(userId);
  }

  @Get('patient')
  @UseGuards(RolesGuard)
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Mes ordonnances (patient)' })
  async findByPatient(@CurrentUser('sub') userId: string) {
    return this.prescriptionsService.findByPatient(userId);
  }

  @Post(':id/regenerate-pdf')
  @UseGuards(RolesGuard)
  @Roles('MEDECIN', 'CARDIOLOGUE', 'ADMIN')
  @ApiOperation({ summary: 'Regenerer le PDF d\'une ordonnance' })
  async regeneratePdf(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.prescriptionsService.regeneratePdf(id, userId);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Telecharger le PDF' })
  async download(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const buffer = await this.prescriptionsService.getDownloadBuffer(id, userId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ordonnance-${id}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
