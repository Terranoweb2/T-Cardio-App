import { Controller, Get, Post, Patch, Body, Param, UseGuards, Query, Res, StreamableFile, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { SkipThrottle } from '@nestjs/throttler';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/guards/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';

@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('generate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Generer un rapport PDF' })
  async generate(
    @CurrentUser('sub') userId: string,
    @Body() body: { patientId: string; periodStart: string; periodEnd: string; reportType?: string; doctorNotes?: string },
  ) {
    const doctor = await this.prisma.doctor.findUnique({ where: { userId } });
    return this.reportsService.generateReport({
      ...body,
      doctorId: doctor?.id,
    });
  }

  @Patch(':id/sign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Signer un rapport electroniquement' })
  async signReport(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.reportsService.signReport(id, userId);
  }

  @Post('generate/my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Patient genere son propre rapport' })
  async generateMyReport(
    @CurrentUser('sub') userId: string,
    @Body() body: { periodDays?: number },
  ) {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) return { error: 'Patient profile required' };

    // Find patient's active linked doctor
    const activeLink = await this.prisma.patientDoctorLink.findFirst({
      where: { patientId: patient.id, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    const periodDays = body.periodDays || 30;
    const periodEnd = new Date();
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - periodDays);
    return this.reportsService.generateReport({
      patientId: patient.id,
      doctorId: activeLink?.doctorId || undefined,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    });
  }

  @Get('complete-medical-file')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('PATIENT')
  @SkipThrottle()
  @ApiOperation({ summary: 'Exporter le dossier medical complet (patient)' })
  async downloadMyMedicalFile(
    @CurrentUser('sub') userId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) throw new UnauthorizedException('Patient profile required');
    const buffer = await this.reportsService.generateCompleteMedicalFile(patient.id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="dossier-medical-complet.pdf"',
      'Content-Length': buffer.length.toString(),
    });
    return new StreamableFile(buffer);
  }

  @Get('patient/:patientId/medical-file')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @SkipThrottle()
  @ApiOperation({ summary: 'Exporter le dossier medical complet d\'un patient (medecin)' })
  async downloadPatientMedicalFile(
    @Param('patientId') patientId: string,
    @CurrentUser('sub') userId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    // Verify doctor has access to this patient
    const doctor = await this.prisma.doctor.findUnique({ where: { userId } });
    if (!doctor) throw new UnauthorizedException('Doctor profile required');
    const link = await this.prisma.patientDoctorLink.findFirst({
      where: { patientId, doctorId: doctor.id, status: 'ACTIVE' },
    });
    if (!link) throw new UnauthorizedException('No active link with this patient');
    const buffer = await this.reportsService.generateCompleteMedicalFile(patientId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="dossier-medical-complet.pdf"',
      'Content-Length': buffer.length.toString(),
    });
    return new StreamableFile(buffer);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Mes rapports' })
  async getMyReports(@CurrentUser('sub') userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) return [];
    return this.reportsService.findByPatient(patient.id);
  }

  @Get('doctor')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Rapports generes par le medecin' })
  async getDoctorReports(@CurrentUser('sub') userId: string) {
    const doctor = await this.prisma.doctor.findUnique({ where: { userId } });
    if (!doctor) return [];
    return this.reportsService.findByDoctor(doctor.id);
  }

  @Get('patient/:patientId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('MEDECIN', 'CARDIOLOGUE', 'ADMIN')
  @ApiOperation({ summary: 'Rapports d\'un patient' })
  async getPatientReports(@Param('patientId') patientId: string) {
    return this.reportsService.findByPatient(patientId);
  }

  @Get(':id/download')
  @SkipThrottle()
  @ApiOperation({ summary: 'Telecharger un rapport (token via query param)' })
  async download(
    @Param('id') id: string,
    @Query('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    // Manually verify JWT from query param (window.open cannot send headers)
    if (!token) {
      throw new UnauthorizedException('Token is required');
    }

    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const userId = payload.sub;
    if (!userId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Get the file buffer from storage
    const buffer = await this.reportsService.getFileBuffer(id, userId);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="rapport.pdf"',
      'Content-Length': buffer.length.toString(),
    });

    return new StreamableFile(buffer);
  }
}
