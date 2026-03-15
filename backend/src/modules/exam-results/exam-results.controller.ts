import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ExamType } from '@prisma/client';
import { ExamResultsService } from './exam-results.service';
import { UploadExamDto } from './dto/upload-exam.dto';
import { AnnotateExamDto } from './dto/annotate-exam.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/guards/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';

@ApiTags('Exam Results')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('exam-results')
export class ExamResultsController {
  constructor(
    private readonly examResultsService: ExamResultsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('upload')
  @Roles('PATIENT')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: "Telecharger un resultat d'examen" })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'type'],
      properties: {
        file: { type: 'string', format: 'binary', description: "Fichier de l'examen" },
        type: { type: 'string', enum: Object.values(ExamType), description: "Type d'examen" },
        title: { type: 'string', description: "Titre de l'examen" },
        notes: { type: 'string', description: 'Notes supplementaires' },
      },
    },
  })
  async upload(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadExamDto,
  ) {
    const patient = await this.prisma.patient.findUnique({
      where: { userId },
    });

    if (!patient) {
      throw new BadRequestException('Profil patient introuvable');
    }

    return this.examResultsService.upload(patient.id, file, dto);
  }

  @Get()
  @Roles('PATIENT', 'MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: "Lister les resultats d'examens" })
  @ApiQuery({ name: 'patientId', required: false, description: 'ID du patient (pour les medecins)' })
  @ApiQuery({ name: 'type', required: false, enum: ExamType, description: "Filtrer par type d'examen" })
  async findAll(
    @CurrentUser() user: { sub: string; role: string },
    @Query('patientId') queryPatientId?: string,
    @Query('type') type?: ExamType,
  ) {
    let patientId: string;

    if (user.role === 'PATIENT') {
      const patient = await this.prisma.patient.findUnique({
        where: { userId: user.sub },
      });
      if (!patient) {
        throw new BadRequestException('Profil patient introuvable');
      }
      patientId = patient.id;
    } else {
      // Doctor role: require patientId query param
      if (!queryPatientId) {
        throw new BadRequestException(
          "Le parametre patientId est obligatoire pour les medecins",
        );
      }

      // Verify doctor has active link to the patient
      const doctor = await this.prisma.doctor.findUnique({
        where: { userId: user.sub },
      });
      if (!doctor) {
        throw new BadRequestException('Profil medecin introuvable');
      }

      const link = await this.prisma.patientDoctorLink.findFirst({
        where: {
          patientId: queryPatientId,
          doctorId: doctor.id,
          status: 'ACTIVE',
        },
      });
      if (!link) {
        throw new BadRequestException('Aucun lien actif avec ce patient');
      }

      patientId = queryPatientId;
    }

    return this.examResultsService.findAll(patientId, type);
  }

  @Get(':id')
  @Roles('PATIENT', 'MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: "Obtenir un resultat d'examen par ID" })
  async findById(
    @CurrentUser('sub') userId: string,
    @Param('id') examId: string,
  ) {
    return this.examResultsService.findById(examId, userId);
  }

  @Get(':id/file')
  @Roles('PATIENT', 'MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: "Obtenir l'URL du fichier d'examen" })
  async getFileUrl(
    @CurrentUser('sub') userId: string,
    @Param('id') examId: string,
  ) {
    // Verify access first
    await this.examResultsService.findById(examId, userId);

    return this.examResultsService.getFileUrl(examId);
  }

  @Delete(':id')
  @Roles('PATIENT')
  @ApiOperation({ summary: "Supprimer un resultat d'examen" })
  async delete(
    @CurrentUser('sub') userId: string,
    @Param('id') examId: string,
  ) {
    const patient = await this.prisma.patient.findUnique({
      where: { userId },
    });

    if (!patient) {
      throw new BadRequestException('Profil patient introuvable');
    }

    return this.examResultsService.delete(patient.id, examId);
  }

  @Patch(':id/annotate')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: "Ajouter un commentaire medecin sur un examen" })
  async annotate(
    @CurrentUser('sub') userId: string,
    @Param('id') examId: string,
    @Body() dto: AnnotateExamDto,
  ) {
    return this.examResultsService.annotate(userId, examId, dto);
  }
}
