import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UploadExamDto } from './dto/upload-exam.dto';
import { AnnotateExamDto } from './dto/annotate-exam.dto';
import { ExamType } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as path from 'path';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

@Injectable()
export class ExamResultsService {
  private readonly logger = new Logger(ExamResultsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Upload an exam result file (patient only).
   */
  async upload(
    patientId: string,
    file: Express.Multer.File,
    dto: UploadExamDto,
  ) {
    if (!file) {
      throw new BadRequestException('Le fichier est obligatoire');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `Le fichier depasse la taille maximale autorisee (${MAX_FILE_SIZE / (1024 * 1024)} Mo)`,
      );
    }

    const ext = path.extname(file.originalname).replace('.', '') || 'bin';
    const filePath = `exam-results/${patientId}/${randomUUID()}.${ext}`;

    await this.storageService.uploadFile(filePath, file.buffer, file.mimetype);

    const examResult = await this.prisma.examResult.create({
      data: {
        patientId,
        type: dto.type,
        title: dto.title,
        fileUrl: filePath,
        fileName: file.originalname,
        fileSizeBytes: file.size,
        notes: dto.notes,
      },
    });

    this.logger.log(
      `Examen uploade: ${examResult.id} (${file.originalname}, ${file.size} octets)`,
    );

    return examResult;
  }

  /**
   * List exam results for a patient, optionally filtered by type.
   */
  async findAll(patientId: string, type?: ExamType) {
    return this.prisma.examResult.findMany({
      where: {
        patientId,
        ...(type && { type }),
      },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  /**
   * Get a single exam result by ID with ownership verification.
   */
  async findById(examId: string, userId: string) {
    const exam = await this.prisma.examResult.findUnique({
      where: { id: examId },
      include: {
        patient: { select: { id: true, userId: true } },
      },
    });

    if (!exam) {
      throw new NotFoundException("Resultat d'examen introuvable");
    }

    // Check if user is the patient
    if (exam.patient.userId === userId) {
      return exam;
    }

    // Check if user is a linked doctor
    const doctor = await this.prisma.doctor.findUnique({
      where: { userId },
    });

    if (doctor) {
      const link = await this.prisma.patientDoctorLink.findFirst({
        where: {
          patientId: exam.patientId,
          doctorId: doctor.id,
          status: 'ACTIVE',
        },
      });

      if (link) {
        return exam;
      }
    }

    throw new ForbiddenException(
      "Vous n'avez pas acces a ce resultat d'examen",
    );
  }

  /**
   * Delete an exam result (patient only, with ownership check).
   */
  async delete(patientId: string, examId: string) {
    const exam = await this.prisma.examResult.findUnique({
      where: { id: examId },
    });

    if (!exam) {
      throw new NotFoundException("Resultat d'examen introuvable");
    }

    if (exam.patientId !== patientId) {
      throw new ForbiddenException(
        "Vous n'avez pas le droit de supprimer ce resultat",
      );
    }

    // Delete file from MinIO
    try {
      await this.storageService.deleteFile(exam.fileUrl);
    } catch (error) {
      this.logger.warn(
        `Echec de la suppression du fichier MinIO (${exam.fileUrl}): ${error.message}`,
      );
    }

    // Delete DB record
    await this.prisma.examResult.delete({ where: { id: examId } });

    this.logger.log(`Examen supprime: ${examId}`);

    return { message: "Resultat d'examen supprime avec succes" };
  }

  /**
   * Doctor annotates an exam result with a comment.
   */
  async annotate(
    doctorUserId: string,
    examId: string,
    dto: AnnotateExamDto,
  ) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { userId: doctorUserId },
    });

    if (!doctor) {
      throw new NotFoundException('Medecin introuvable');
    }

    const exam = await this.prisma.examResult.findUnique({
      where: { id: examId },
    });

    if (!exam) {
      throw new NotFoundException("Resultat d'examen introuvable");
    }

    // Verify doctor has an active link to the patient
    const link = await this.prisma.patientDoctorLink.findFirst({
      where: {
        patientId: exam.patientId,
        doctorId: doctor.id,
        status: 'ACTIVE',
      },
    });

    if (!link) {
      throw new ForbiddenException('Aucun lien actif avec ce patient');
    }

    const updated = await this.prisma.examResult.update({
      where: { id: examId },
      data: {
        doctorComment: dto.doctorComment,
        commentedBy: doctor.id,
      },
    });

    this.logger.log(
      `Examen ${examId} annote par le medecin ${doctor.id}`,
    );

    return updated;
  }

  /**
   * Get a presigned file URL for downloading an exam result.
   */
  async getFileUrl(examId: string) {
    const exam = await this.prisma.examResult.findUnique({
      where: { id: examId },
    });

    if (!exam) {
      throw new NotFoundException("Resultat d'examen introuvable");
    }

    const url = await this.storageService.getPresignedUrl(exam.fileUrl);

    return { url, fileName: exam.fileName };
  }
}
