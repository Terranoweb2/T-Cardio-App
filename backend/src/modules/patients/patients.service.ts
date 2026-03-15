import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { EmergencyGateway } from '../emergency/emergency.gateway';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

@Injectable()
export class PatientsService {
  private readonly logger = new Logger(PatientsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly emergencyGateway: EmergencyGateway,
  ) {}

  async create(userId: string, dto: CreatePatientDto) {
    return this.prisma.patient.create({
      data: {
        userId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        birthDate: new Date(dto.birthDate),
        gender: dto.gender,
        heightCm: dto.heightCm,
        weightKg: dto.weightKg,
        medicalStatus: dto.medicalStatus,
        emergencyContactName: dto.emergencyContactName,
        emergencyContactPhone: dto.emergencyContactPhone,
      },
    });
  }

  async findByUserId(userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) throw new NotFoundException('Patient profile not found');
    return patient;
  }

  async findById(id: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id } });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async update(userId: string, dto: UpdatePatientDto) {
    const patient = await this.findByUserId(userId);
    const updated = await this.prisma.patient.update({
      where: { id: patient.id },
      data: {
        ...dto,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
      },
    });

    // Notify all linked doctors in real-time
    try {
      const updatedFields = Object.keys(dto).filter((k) => (dto as any)[k] !== undefined);
      const patientName = `${updated.firstName || ''} ${updated.lastName || ''}`.trim() || 'Patient';

      const doctorLinks = await this.prisma.patientDoctorLink.findMany({
        where: { patientId: patient.id, status: 'ACTIVE' },
      });

      for (const link of doctorLinks) {
        // WebSocket real-time notification
        this.emergencyGateway.notifyPatientProfileUpdated(link.doctorId, {
          patientId: patient.id,
          patientName,
          updatedFields,
        });

        // Persistent alert
        await this.prisma.alert.create({
          data: {
            patientId: patient.id,
            doctorId: link.doctorId,
            type: 'SYSTEM',
            title: 'Profil patient mis a jour',
            message: `${patientName} a mis a jour son profil (${updatedFields.join(', ')}).`,
            severity: 'FAIBLE',
          },
        });
      }

      if (doctorLinks.length > 0) {
        this.logger.log(`Profile update notification sent to ${doctorLinks.length} doctor(s) for patient ${patient.id}`);
      }
    } catch (err) {
      this.logger.warn(`Failed to notify doctors about profile update: ${err.message}`);
    }

    return updated;
  }

  async getBMI(userId: string): Promise<number | null> {
    const patient = await this.findByUserId(userId);
    if (!patient.heightCm || !patient.weightKg) return null;
    const heightM = patient.heightCm / 100;
    return Number((Number(patient.weightKg) / (heightM * heightM)).toFixed(1));
  }

  async findByDoctorId(doctorId: string) {
    const links = await this.prisma.patientDoctorLink.findMany({
      where: { doctorId, status: 'ACTIVE' },
      include: {
        patient: {
          include: {
            measurements: {
              orderBy: { measuredAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });
    return links.map((l) => l.patient);
  }

  // ==================== MY DOCTORS ====================

  async getMyDoctors(userId: string) {
    const patient = await this.findByUserId(userId);
    const links = await this.prisma.patientDoctorLink.findMany({
      where: { patientId: patient.id, status: 'ACTIVE' },
      include: {
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            specialty: true,
            practiceAddress: true,
            practicePhone: true,
          },
        },
      },
    });
    return links.map((l) => ({
      id: l.id,
      doctorId: l.doctorId,
      doctor: l.doctor,
      startedAt: l.startedAt,
    }));
  }

  // ==================== INVITATION TOKEN REDEMPTION ====================

  async redeemInvitationToken(userId: string, tokenCode: string) {
    const patient = await this.findByUserId(userId);

    // Find the token
    const invitation = await this.prisma.invitationToken.findUnique({
      where: { token: tokenCode.toUpperCase().trim() },
      include: {
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            specialty: true,
            practiceAddress: true,
            practicePhone: true,
          },
        },
      },
    });

    if (!invitation) {
      throw new BadRequestException('Code d\'invitation invalide');
    }

    if (invitation.isUsed) {
      throw new BadRequestException('Ce code d\'invitation a deja ete utilise');
    }

    if (new Date() > invitation.expiresAt) {
      throw new BadRequestException('Ce code d\'invitation a expire');
    }

    // Check existing active link with this doctor
    const existingLink = await this.prisma.patientDoctorLink.findFirst({
      where: { patientId: patient.id, doctorId: invitation.doctorId, status: 'ACTIVE' },
    });

    if (existingLink) {
      throw new BadRequestException('Vous etes deja associe a ce medecin');
    }

    // Create link + mark token as used in a transaction
    await this.prisma.$transaction([
      this.prisma.patientDoctorLink.create({
        data: {
          patientId: patient.id,
          doctorId: invitation.doctorId,
          status: 'ACTIVE',
          initiatedBy: invitation.doctorId,
        },
      }),
      this.prisma.invitationToken.update({
        where: { id: invitation.id },
        data: {
          isUsed: true,
          usedBy: patient.id,
          usedAt: new Date(),
        },
      }),
    ]);

    return {
      message: 'Association reussie',
      doctor: invitation.doctor,
    };
  }

  // ==================== PROFILE PHOTO ====================

  async uploadProfilePhoto(userId: string, file: Express.Multer.File) {
    const patient = await this.findByUserId(userId);

    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const filename = `${uuidv4()}${ext}`;
    const storagePath = `profile-photos/patients/${patient.id}/${filename}`;

    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };
    const contentType = mimeMap[ext] || 'image/jpeg';

    await this.storage.uploadFile(storagePath, file.buffer, contentType);

    const profilePhotoUrl = `/patients/profile/photo/${filename}`;

    await this.prisma.patient.update({
      where: { id: patient.id },
      data: { profilePhotoUrl },
    });

    return { profilePhotoUrl };
  }

  async getProfilePhotoStream(filename: string): Promise<NodeJS.ReadableStream> {
    // Search for the file in profile-photos/patients/*/filename
    // We need to find which patient folder it's in, so we search by profilePhotoUrl
    const patient = await this.prisma.patient.findFirst({
      where: { profilePhotoUrl: `/patients/profile/photo/${filename}` },
    });

    if (!patient) {
      throw new NotFoundException('Photo not found');
    }

    const storagePath = `profile-photos/patients/${patient.id}/${filename}`;
    return this.storage.getFileStream(storagePath);
  }
}
