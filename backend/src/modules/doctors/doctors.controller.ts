import { Controller, Get, Post, Patch, Delete, Body, UseGuards, Param, Query, UseInterceptors, UploadedFile, BadRequestException, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { DoctorsService } from './doctors.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { GenerateTokenDto } from './dto/generate-token.dto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/guards/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Public } from '../../core/guards/public.decorator';

@ApiTags('Doctors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('doctors')
export class DoctorsController {
  constructor(
    private readonly doctorsService: DoctorsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('profile')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Creer profil medecin' })
  async createProfile(@CurrentUser('sub') userId: string, @Body() dto: CreateDoctorDto) {
    return this.doctorsService.create(userId, dto);
  }

  @Get('profile')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Mon profil medecin' })
  async getMyProfile(@CurrentUser('sub') userId: string) {
    return this.doctorsService.findByUserId(userId);
  }

  @Get('verified')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Medecins disponibles pour prise de rendez-vous (patient)' })
  async getVerifiedDoctors(@CurrentUser('sub') userId: string) {
    return this.doctorsService.getVerifiedDoctorsForPatient(userId);
  }

  @Patch('profile')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Modifier profil medecin' })
  async updateProfile(@CurrentUser('sub') userId: string, @Body() dto: UpdateDoctorDto) {
    return this.doctorsService.update(userId, dto);
  }

  @Post('profile/photo')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @UseInterceptors(FileInterceptor('photo'))
  @ApiOperation({ summary: 'Upload profile photo' })
  async uploadProfilePhoto(
    @CurrentUser('sub') userId: string,
    @UploadedFile() photo: Express.Multer.File,
  ) {
    if (!photo) {
      throw new BadRequestException('Photo file is required');
    }

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(photo.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, and WebP images are allowed');
    }

    if (photo.size > 5 * 1024 * 1024) {
      throw new BadRequestException('File size must not exceed 5MB');
    }

    return this.doctorsService.uploadProfilePhoto(userId, photo);
  }

  @Get('profile/photo/:filename')
  @Public()
  @ApiOperation({ summary: 'Get profile photo' })
  async getProfilePhoto(@Param('filename') filename: string, @Res() res: Response) {
    const stream = await this.doctorsService.getProfilePhotoStream(filename);

    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    };
    const contentType = mimeMap[ext || ''] || 'application/octet-stream';

    res.set({ 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' });
    (stream as any).pipe(res);
  }

  // ==================== SIGNATURE & STAMP ====================

  @Post('signature')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @UseInterceptors(FileInterceptor('signature'))
  @ApiOperation({ summary: 'Upload signature image' })
  async uploadSignature(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Fichier signature requis');
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('Seuls les formats JPEG, PNG et WebP sont acceptes');
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('La taille du fichier ne doit pas depasser 2 Mo');
    }
    return this.doctorsService.uploadSignature(userId, file);
  }

  @Post('stamp')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @UseInterceptors(FileInterceptor('stamp'))
  @ApiOperation({ summary: 'Upload stamp/cachet image' })
  async uploadStamp(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Fichier cachet requis');
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('Seuls les formats JPEG, PNG et WebP sont acceptes');
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('La taille du fichier ne doit pas depasser 2 Mo');
    }
    return this.doctorsService.uploadStamp(userId, file);
  }

  @Get('signature/:filename')
  @Public()
  @ApiOperation({ summary: 'Get signature image' })
  async getSignatureImage(@Param('filename') filename: string, @Res() res: Response) {
    const stream = await this.doctorsService.getFileStream('signatures', filename);
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
    res.set({ 'Content-Type': mimeMap[ext || ''] || 'application/octet-stream', 'Cache-Control': 'public, max-age=86400' });
    (stream as any).pipe(res);
  }

  @Get('stamp/:filename')
  @Public()
  @ApiOperation({ summary: 'Get stamp/cachet image' })
  async getStampImage(@Param('filename') filename: string, @Res() res: Response) {
    const stream = await this.doctorsService.getFileStream('stamps', filename);
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
    res.set({ 'Content-Type': mimeMap[ext || ''] || 'application/octet-stream', 'Cache-Control': 'public, max-age=86400' });
    (stream as any).pipe(res);
  }

  @Get('patients')
  @Roles('MEDECIN', 'CARDIOLOGUE', 'ADMIN')
  @ApiOperation({ summary: 'Liste des patients suivis' })
  async getMyPatients(@CurrentUser('sub') userId: string) {
    return this.doctorsService.getPatients(userId);
  }

  @Post('patients/link')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Lier un patient par email' })
  async linkPatientByEmail(
    @CurrentUser('sub') userId: string,
    @Body() body: { patientEmail: string },
  ) {
    return this.doctorsService.linkPatientByEmail(userId, body.patientEmail);
  }

  @Post('patients/:patientId/link')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Lier un patient par ID' })
  async linkPatient(@CurrentUser('sub') userId: string, @Param('patientId') patientId: string) {
    return this.doctorsService.linkPatient(userId, patientId);
  }

  // ==================== INVITATION TOKENS ====================

  @Post('invitations/generate')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Generer un token d\'invitation patient' })
  async generateInvitationToken(
    @CurrentUser('sub') userId: string,
    @Body() dto: GenerateTokenDto,
  ) {
    return this.doctorsService.generateInvitationToken(userId, dto.expiresInHours);
  }

  @Get('invitations')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Liste de mes invitations' })
  async getMyInvitations(@CurrentUser('sub') userId: string) {
    return this.doctorsService.getMyInvitations(userId);
  }

  @Delete('invitations/:id')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Revoquer une invitation' })
  async revokeInvitation(
    @CurrentUser('sub') userId: string,
    @Param('id') tokenId: string,
  ) {
    return this.doctorsService.revokeInvitation(userId, tokenId);
  }

  // ==================== AVAILABILITY (AGENDA) ====================

  @Get('availability')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Mes creneaux de disponibilite' })
  async getMyAvailabilities(@CurrentUser('sub') userId: string) {
    return this.doctorsService.getAvailabilities(userId);
  }

  @Post('availability')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Ajouter un creneau de disponibilite' })
  async setAvailability(
    @CurrentUser('sub') userId: string,
    @Body() body: { dayOfWeek: number; startTime: string; endTime: string; slotDurationMin?: number },
  ) {
    return this.doctorsService.setAvailability(userId, body);
  }

  @Post('availability/bulk')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Definir tous les creneaux (remplace les existants)' })
  async setBulkAvailabilities(
    @CurrentUser('sub') userId: string,
    @Body() body: { slots: Array<{ dayOfWeek: number; startTime: string; endTime: string; slotDurationMin?: number }> },
  ) {
    return this.doctorsService.setBulkAvailabilities(userId, body.slots);
  }

  @Delete('availability/:id')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Supprimer un creneau' })
  async deleteAvailability(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.doctorsService.deleteAvailability(userId, id);
  }

  // ==================== UNAVAILABILITIES (ABSENCES) ====================

  @Get('unavailability')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Mes indisponibilites' })
  async getMyUnavailabilities(@CurrentUser('sub') userId: string) {
    return this.doctorsService.getUnavailabilities(userId);
  }

  @Post('unavailability')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Ajouter une indisponibilite' })
  async addUnavailability(
    @CurrentUser('sub') userId: string,
    @Body() body: { date: string; startTime?: string; endTime?: string; reason?: string },
  ) {
    return this.doctorsService.addUnavailability(userId, body);
  }

  @Delete('unavailability/:id')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Supprimer une indisponibilite' })
  async deleteUnavailability(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.doctorsService.deleteUnavailability(userId, id);
  }

  // ==================== CONSULTATION STATISTICS ====================

  @Get('consultation-stats')
  @Roles('MEDECIN', 'CARDIOLOGUE', 'ADMIN')
  @ApiOperation({ summary: 'Statistiques de consultations + envoi email' })
  async getConsultationStats(@CurrentUser('sub') userId: string) {
    return this.doctorsService.getConsultationStats(userId);
  }

  // ==================== PUBLIC AGENDA (FOR PATIENTS) ====================

  @Get(':doctorId/available-today')
  @Roles('PATIENT', 'MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Verifier si le medecin prend des teleconsultations aujourd\'hui' })
  async isDoctorAvailableToday(@Param('doctorId') doctorId: string) {
    const available = await this.doctorsService.isDoctorAvailableToday(doctorId);
    return { available };
  }

  @Get(':doctorId/agenda')
  @Roles('PATIENT', 'MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Voir l\'agenda public d\'un medecin' })
  async getDoctorAgenda(@Param('doctorId') doctorId: string) {
    return this.doctorsService.getDoctorPublicAgenda(doctorId);
  }

  @Get(':doctorId/slots')
  @Roles('PATIENT', 'MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Creneaux disponibles pour une date' })
  async getAvailableSlots(
    @Param('doctorId') doctorId: string,
    @Query('date') date: string,
  ) {
    return this.doctorsService.getAvailableSlots(doctorId, date);
  }

  // ==================== DOCTOR REVIEWS ====================

  @Get(':doctorId/reviews')
  @Roles('PATIENT', 'MEDECIN', 'CARDIOLOGUE', 'ADMIN')
  @ApiOperation({ summary: 'Avis sur un medecin' })
  async getDoctorReviews(
    @Param('doctorId') doctorId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const p = page || 1;
    const l = limit || 20;

    const [reviews, total] = await Promise.all([
      this.prisma.doctorReview.findMany({
        where: { doctorId },
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * l,
        take: l,
        include: { patient: { select: { firstName: true, lastName: true } } },
      }),
      this.prisma.doctorReview.count({ where: { doctorId } }),
    ]);

    return {
      data: reviews,
      pagination: { page: p, limit: l, total, totalPages: Math.ceil(total / l) },
    };
  }

  // ==================== CONFIDENTIAL DISCONNECT ====================

  @Patch('patients/:patientId/disconnect')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Deconnecter un patient (confidentiel)' })
  async disconnectPatient(
    @CurrentUser('sub') userId: string,
    @Param('patientId') patientId: string,
    @Body() body: { reason?: string },
  ) {
    return this.doctorsService.disconnectPatient(userId, patientId, body?.reason);
  }
}
