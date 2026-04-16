import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, UseInterceptors, UploadedFile, BadRequestException, ForbiddenException, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { TeleconsultationService } from './teleconsultation.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/guards/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { SubscriptionGuard } from '../../core/guards/subscription.guard';
import { CreditGuard, RequiredCredits } from '../../core/guards/credit.guard';

@ApiTags('Teleconsultation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('teleconsultations')
export class TeleconsultationController {
  constructor(
    private readonly service: TeleconsultationService,
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Verify the authenticated user is a participant in the teleconsultation.
   */
  private async verifyParticipant(teleconsultationId: string, userId: string): Promise<void> {
    const tc = await this.prisma.teleconsultation.findUnique({
      where: { id: teleconsultationId },
      include: {
        doctor: { select: { userId: true } },
        patient: { select: { userId: true } },
      },
    });
    if (!tc) throw new BadRequestException('Teleconsultation introuvable');
    if (tc.doctor?.userId !== userId && tc.patient?.userId !== userId) {
      throw new ForbiddenException('Vous n\'etes pas autorise a acceder a cette teleconsultation');
    }
  }

  @Post()
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Planifier une teleconsultation' })
  async schedule(
    @CurrentUser('sub') userId: string,
    @Body() body: { patientId: string; scheduledAt: string; durationMinutes?: number; reason?: string },
  ) {
    return this.service.schedule(userId, body);
  }

  @Patch(':id/status')
  @Roles('MEDECIN', 'CARDIOLOGUE', 'PATIENT')
  @ApiOperation({ summary: 'Modifier le statut' })
  async updateStatus(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body('status') status: any,
  ) {
    return this.service.updateStatus(id, status, userId);
  }

  @Get('doctor')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Mes teleconsultations (medecin)' })
  async getDoctorConsultations(@CurrentUser('sub') userId: string) {
    return this.service.findByDoctor(userId);
  }

  @Get('patient')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Mes teleconsultations (patient)' })
  async getPatientConsultations(@CurrentUser('sub') userId: string) {
    return this.service.findByPatient(userId);
  }

  @Post('request')
  @Roles('PATIENT')
  @UseGuards(SubscriptionGuard, CreditGuard)
  @RequiredCredits(5000)
  @ApiOperation({ summary: 'Demander une teleconsultation (patient)' })
  async requestConsultation(
    @CurrentUser('sub') userId: string,
    @Body() body: { motif: string; scheduledAt?: string },
  ) {
    return this.service.requestByPatient(userId, body.motif, body.scheduledAt);
  }

  @Patch(':id/summary')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Ajouter un resume post-consultation' })
  async addSummary(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() body: { summary: string; followUpNeeded: boolean; followUpDate?: string },
  ) {
    return this.service.addSummary(id, userId, body);
  }

  @Get(':id/messages')
  @Roles('MEDECIN', 'CARDIOLOGUE', 'PATIENT')
  @ApiOperation({ summary: 'Messages de la teleconsultation' })
  async getMessages(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    await this.verifyParticipant(id, userId);
    return this.service.getMessages(id);
  }

  @Post(':id/messages')
  @Roles('MEDECIN', 'CARDIOLOGUE', 'PATIENT')
  @ApiOperation({ summary: 'Envoyer un message' })
  async sendMessage(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: string,
    @Body('content') content: string,
  ) {
    return this.service.addMessage(id, userId, role, content);
  }

  @Post(':id/upload')
  @Roles('MEDECIN', 'CARDIOLOGUE', 'PATIENT')
  @ApiOperation({ summary: 'Upload un fichier dans le chat' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadChatFile(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Aucun fichier fourni');
    if (file.size > 10 * 1024 * 1024) throw new BadRequestException('Fichier trop volumineux (max 10MB)');
    await this.verifyParticipant(id, userId);
    return this.service.uploadChatFile(id, file);
  }

  @Get(':id/files/:filename')
  @Roles('MEDECIN', 'CARDIOLOGUE', 'PATIENT')
  @ApiOperation({ summary: 'Recuperer un fichier du chat' })
  async getChatFile(
    @Param('id') id: string,
    @Param('filename') filename: string,
    @CurrentUser('sub') userId: string,
    @Res() res: Response,
  ) {
    await this.verifyParticipant(id, userId);
    const fileKey = `chat-files/${id}/${filename}`;
    const stream = await this.storageService.getFileStream(fileKey);

    const ext = filename.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
      webp: 'image/webp', pdf: 'application/pdf', doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    const contentType = contentTypes[ext || ''] || 'application/octet-stream';

    res.set({ 'Content-Type': contentType, 'Cache-Control': 'public, max-age=3600' });
    (stream as any).pipe(res);
  }

  @Post(':id/review')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Noter une teleconsultation (patient)' })
  async submitReview(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() body: { rating: number; comment?: string },
  ) {
    return this.service.submitReview(userId, id, body.rating, body.comment);
  }

  @Patch(':id/reschedule')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Reporter un rendez-vous' })
  async reschedule(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() body: { scheduledAt: string },
  ) {
    return this.service.reschedule(id, userId, body.scheduledAt);
  }

  @Patch(':id/cancel-appointment')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Annuler un rendez-vous depuis l\'agenda' })
  async cancelAppointment(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() body: { reason?: string },
  ) {
    return this.service.cancelAppointment(id, userId, body?.reason);
  }

  @Delete(':id')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Supprimer une teleconsultation terminee/annulee' })
  async delete(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.delete(id, userId);
  }

  @Get(':id')
  @Roles('MEDECIN', 'CARDIOLOGUE', 'PATIENT', 'ADMIN')
  @ApiOperation({ summary: 'Details d\'une teleconsultation' })
  async getById(@Param('id') id: string, @CurrentUser('sub') userId: string, @CurrentUser('role') role: string) {
    // Admins can view any teleconsultation; participants must be verified
    if (role !== 'ADMIN') {
      await this.verifyParticipant(id, userId);
    }
    return this.service.findById(id);
  }
}
