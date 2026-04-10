import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { EmailService } from '../../core/email/email.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { UpdatePricingDto } from './dto/update-pricing.dto';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

@Injectable()
export class DoctorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly emailService: EmailService,
  ) {}

  async create(userId: string, dto: CreateDoctorDto) {
    return this.prisma.doctor.create({
      data: { userId, ...dto },
    });
  }

  async findByUserId(userId: string) {
    const doctor = await this.prisma.doctor.findUnique({ where: { userId } });
    if (!doctor) throw new NotFoundException('Doctor profile not found');
    return doctor;
  }

  async getVerifiedDoctorsForPatient(userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) throw new NotFoundException('Patient non trouve');

    const links = await this.prisma.patientDoctorLink.findMany({
      where: { patientId: patient.id, status: 'ACTIVE' },
      include: {
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            specialty: true,
            profilePhotoUrl: true,
            consultationPriceXof: true,
            practiceAddress: true,
            user: { select: { role: true } },
          },
        },
      },
    });

    // Flatten user.role onto the doctor object for frontend convenience
    return links.map((l) => ({
      ...l.doctor,
      role: l.doctor.user?.role ?? 'MEDECIN',
      user: undefined,
    }));
  }

  async findById(id: string) {
    const doctor = await this.prisma.doctor.findUnique({ where: { id } });
    if (!doctor) throw new NotFoundException('Doctor not found');
    return doctor;
  }

  async update(userId: string, dto: UpdateDoctorDto) {
    const doctor = await this.findByUserId(userId);
    return this.prisma.doctor.update({
      where: { id: doctor.id },
      data: dto,
    });
  }

  /**
   * Update a doctor's pricing configuration.
   * Only the doctor themselves can call this (enforced at the controller level).
   */
  async updatePricing(userId: string, dto: UpdatePricingDto) {
    const doctor = await this.findByUserId(userId);

    // At least one price field must be provided
    if (
      dto.consultationPriceXof === undefined &&
      dto.messagingPriceXof === undefined &&
      dto.emergencyPriceXof === undefined
    ) {
      throw new BadRequestException('Au moins un champ de tarification doit etre fourni');
    }

    const updateData: Record<string, number> = {};

    if (dto.consultationPriceXof !== undefined) {
      updateData.consultationPriceXof = dto.consultationPriceXof;
    }
    if (dto.messagingPriceXof !== undefined) {
      updateData.messagingPriceXof = dto.messagingPriceXof;
    }
    if (dto.emergencyPriceXof !== undefined) {
      updateData.emergencyPriceXof = dto.emergencyPriceXof;
    }

    return this.prisma.doctor.update({
      where: { id: doctor.id },
      data: updateData,
      select: {
        id: true,
        consultationPriceXof: true,
        messagingPriceXof: true,
        emergencyPriceXof: true,
        platformCommissionPct: true,
      },
    });
  }

  async getPatients(userId: string) {
    const doctor = await this.findByUserId(userId);
    const links = await this.prisma.patientDoctorLink.findMany({
      where: { doctorId: doctor.id, status: 'ACTIVE' },
      include: {
        patient: {
          include: {
            measurements: { orderBy: { measuredAt: 'desc' }, take: 1 },
            aiAnalyses: { orderBy: { createdAt: 'desc' }, take: 1 },
            alerts: { where: { isRead: false }, orderBy: { createdAt: 'desc' }, take: 5 },
          },
        },
      },
    });
    return links.map((l) => {
      const pat = l.patient;
      const lastM = pat.measurements[0] || null;
      const lastA = pat.aiAnalyses[0] || null;
      // Calculate age
      let age: number | null = null;
      if (pat.birthDate) {
        age = Math.floor((Date.now() - new Date(pat.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      }
      // Calculate BMI
      let bmi: number | null = null;
      if (pat.heightCm && pat.weightKg) {
        const heightM = pat.heightCm / 100;
        bmi = Number((Number(pat.weightKg) / (heightM * heightM)).toFixed(1));
      }
      return {
        ...pat,
        age,
        bmi,
        lastMeasurement: lastM,
        lastSystolic: lastM?.systolic || null,
        lastDiastolic: lastM?.diastolic || null,
        lastRiskLevel: lastA?.riskLevel || lastM?.riskLevel || null,
        lastMeasuredAt: lastM?.measuredAt || null,
        lastAnalysis: lastA,
        unreadAlerts: pat.alerts,
      };
    });
  }

  async linkPatient(doctorUserId: string, patientId: string) {
    const doctor = await this.findByUserId(doctorUserId);
    return this.prisma.patientDoctorLink.create({
      data: {
        patientId,
        doctorId: doctor.id,
        status: 'ACTIVE',
        initiatedBy: doctor.id,
      },
    });
  }

  async linkPatientByEmail(doctorUserId: string, patientEmail: string) {
    const doctor = await this.findByUserId(doctorUserId);

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: patientEmail.toLowerCase() },
    });
    if (!user) throw new BadRequestException('Aucun utilisateur trouve avec cet email');
    if (user.role !== 'PATIENT') throw new BadRequestException('Cet utilisateur n\'est pas un patient');

    // Find patient profile
    const patient = await this.prisma.patient.findUnique({ where: { userId: user.id } });
    if (!patient) throw new BadRequestException('Ce patient n\'a pas de profil');

    // Check existing link
    const existingLink = await this.prisma.patientDoctorLink.findFirst({
      where: { patientId: patient.id, doctorId: doctor.id, status: 'ACTIVE' },
    });
    if (existingLink) throw new BadRequestException('Ce patient est deja associe');

    return this.prisma.patientDoctorLink.create({
      data: {
        patientId: patient.id,
        doctorId: doctor.id,
        status: 'ACTIVE',
        initiatedBy: doctor.id,
      },
    });
  }

  // ==================== INVITATION TOKENS ====================

  private generateTokenCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1 to avoid confusion
    const bytes = randomBytes(6);
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[bytes[i] % chars.length];
    }
    return `TC-${code}`;
  }

  async generateInvitationToken(userId: string, expiresInHours = 48) {
    const doctor = await this.findByUserId(userId);

    const token = this.generateTokenCode();
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const invitation = await this.prisma.invitationToken.create({
      data: {
        doctorId: doctor.id,
        token,
        expiresAt,
      },
    });

    return {
      id: invitation.id,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    };
  }

  async getMyInvitations(userId: string) {
    const doctor = await this.findByUserId(userId);

    const invitations = await this.prisma.invitationToken.findMany({
      where: { doctorId: doctor.id },
      orderBy: { createdAt: 'desc' },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return invitations.map((inv) => ({
      id: inv.id,
      token: inv.token,
      isUsed: inv.isUsed,
      usedBy: inv.patient
        ? { id: inv.patient.id, firstName: inv.patient.firstName, lastName: inv.patient.lastName }
        : null,
      usedAt: inv.usedAt,
      expiresAt: inv.expiresAt,
      isExpired: !inv.isUsed && new Date() > inv.expiresAt,
      createdAt: inv.createdAt,
    }));
  }

  async revokeInvitation(userId: string, tokenId: string) {
    const doctor = await this.findByUserId(userId);

    const invitation = await this.prisma.invitationToken.findFirst({
      where: { id: tokenId, doctorId: doctor.id },
    });

    if (!invitation) throw new NotFoundException('Invitation non trouvee');
    if (invitation.isUsed) throw new BadRequestException('Cette invitation a deja ete utilisee');

    await this.prisma.invitationToken.delete({ where: { id: tokenId } });
    return { message: 'Invitation revoquee avec succes' };
  }

  // ==================== AVAILABILITY (AGENDA) ====================

  async getAvailabilities(userId: string) {
    const doctor = await this.findByUserId(userId);
    return this.prisma.doctorAvailability.findMany({
      where: { doctorId: doctor.id, isActive: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async setAvailability(userId: string, data: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    slotDurationMin?: number;
  }) {
    const doctor = await this.findByUserId(userId);

    if (data.dayOfWeek < 0 || data.dayOfWeek > 6) {
      throw new BadRequestException('dayOfWeek doit etre entre 0 (Dimanche) et 6 (Samedi)');
    }
    if (data.startTime >= data.endTime) {
      throw new BadRequestException('L\'heure de debut doit etre avant l\'heure de fin');
    }

    // Upsert: update if exists for same day/startTime, create otherwise
    return this.prisma.doctorAvailability.upsert({
      where: {
        doctorId_dayOfWeek_startTime: {
          doctorId: doctor.id,
          dayOfWeek: data.dayOfWeek,
          startTime: data.startTime,
        },
      },
      update: {
        endTime: data.endTime,
        slotDurationMin: data.slotDurationMin || 30,
        isActive: true,
      },
      create: {
        doctorId: doctor.id,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        slotDurationMin: data.slotDurationMin || 30,
      },
    });
  }

  async setBulkAvailabilities(userId: string, slots: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    slotDurationMin?: number;
  }>) {
    const doctor = await this.findByUserId(userId);

    // Disable all current availabilities first
    await this.prisma.doctorAvailability.updateMany({
      where: { doctorId: doctor.id },
      data: { isActive: false },
    });

    // Create/update all new ones
    const results = [];
    for (const slot of slots) {
      if (slot.dayOfWeek < 0 || slot.dayOfWeek > 6) continue;
      if (slot.startTime >= slot.endTime) continue;

      const result = await this.prisma.doctorAvailability.upsert({
        where: {
          doctorId_dayOfWeek_startTime: {
            doctorId: doctor.id,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
          },
        },
        update: {
          endTime: slot.endTime,
          slotDurationMin: slot.slotDurationMin || 30,
          isActive: true,
        },
        create: {
          doctorId: doctor.id,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          slotDurationMin: slot.slotDurationMin || 30,
        },
      });
      results.push(result);
    }

    return results;
  }

  async deleteAvailability(userId: string, availabilityId: string) {
    const doctor = await this.findByUserId(userId);
    const availability = await this.prisma.doctorAvailability.findFirst({
      where: { id: availabilityId, doctorId: doctor.id },
    });
    if (!availability) throw new NotFoundException('Creneau non trouve');

    await this.prisma.doctorAvailability.delete({ where: { id: availabilityId } });
    return { message: 'Creneau supprime' };
  }

  // ==================== UNAVAILABILITIES (ABSENCES) ====================

  async addUnavailability(userId: string, data: {
    date: string;
    startTime?: string;
    endTime?: string;
    reason?: string;
  }) {
    const doctor = await this.findByUserId(userId);
    return this.prisma.doctorUnavailability.create({
      data: {
        doctorId: doctor.id,
        date: new Date(data.date),
        startTime: data.startTime || null,
        endTime: data.endTime || null,
        reason: data.reason || null,
      },
    });
  }

  async getUnavailabilities(userId: string) {
    const doctor = await this.findByUserId(userId);
    return this.prisma.doctorUnavailability.findMany({
      where: { doctorId: doctor.id, date: { gte: new Date() } },
      orderBy: { date: 'asc' },
    });
  }

  async deleteUnavailability(userId: string, unavailabilityId: string) {
    const doctor = await this.findByUserId(userId);
    const item = await this.prisma.doctorUnavailability.findFirst({
      where: { id: unavailabilityId, doctorId: doctor.id },
    });
    if (!item) throw new NotFoundException('Indisponibilite non trouvee');

    await this.prisma.doctorUnavailability.delete({ where: { id: unavailabilityId } });
    return { message: 'Indisponibilite supprimee' };
  }

  // ==================== PUBLIC AVAILABILITY (FOR PATIENTS) ====================

  async getAvailableSlots(doctorId: string, date: string) {
    // Get doctor's availability for the given day
    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay(); // 0-6

    const availabilities = await this.prisma.doctorAvailability.findMany({
      where: { doctorId, dayOfWeek, isActive: true },
      orderBy: { startTime: 'asc' },
    });

    if (availabilities.length === 0) return [];

    // Check for unavailability on that date
    const unavailability = await this.prisma.doctorUnavailability.findFirst({
      where: {
        doctorId,
        date: targetDate,
      },
    });

    // Full-day unavailability
    if (unavailability && !unavailability.startTime) return [];

    // Get existing teleconsultations for that day
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    const [existingConsultations, existingAppointments] = await Promise.all([
      this.prisma.teleconsultation.findMany({
        where: {
          doctorId,
          scheduledAt: { gte: dayStart, lte: dayEnd },
          status: { in: ['PLANNED', 'ACTIVE'] },
        },
        select: { scheduledAt: true, durationMinutes: true },
      }),
      this.prisma.appointment.findMany({
        where: {
          doctorId,
          scheduledAt: { gte: dayStart, lte: dayEnd },
          status: { in: ['APPT_PENDING', 'CONFIRMED'] as any },
        },
        select: { scheduledAt: true, durationMin: true },
      }),
    ]);

    // Generate available time slots
    const slots: Array<{ startTime: string; endTime: string }> = [];

    for (const avail of availabilities) {
      const [startH, startM] = avail.startTime.split(':').map(Number);
      const [endH, endM] = avail.endTime.split(':').map(Number);
      const slotDuration = avail.slotDurationMin;

      let currentMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      while (currentMinutes + slotDuration <= endMinutes) {
        const slotStartH = Math.floor(currentMinutes / 60);
        const slotStartM = currentMinutes % 60;
        const slotEndMinutes = currentMinutes + slotDuration;
        const slotEndH = Math.floor(slotEndMinutes / 60);
        const slotEndM = slotEndMinutes % 60;

        const slotStart = `${String(slotStartH).padStart(2, '0')}:${String(slotStartM).padStart(2, '0')}`;
        const slotEnd = `${String(slotEndH).padStart(2, '0')}:${String(slotEndM).padStart(2, '0')}`;

        // Check if slot is during partial unavailability
        if (unavailability?.startTime && unavailability?.endTime) {
          if (slotStart < unavailability.endTime && slotEnd > unavailability.startTime) {
            currentMinutes += slotDuration;
            continue;
          }
        }

        // Check if slot conflicts with an existing consultation
        const slotDateTime = new Date(targetDate);
        slotDateTime.setHours(slotStartH, slotStartM, 0, 0);
        const sStart = slotDateTime.getTime();
        const sEnd = sStart + slotDuration * 60 * 1000;

        const hasConsultConflict = existingConsultations.some((c) => {
          if (!c.scheduledAt) return false;
          const cStart = new Date(c.scheduledAt).getTime();
          const cEnd = cStart + (c.durationMinutes || 15) * 60 * 1000;
          return sStart < cEnd && sEnd > cStart;
        });

        // Check if slot conflicts with an existing appointment
        const hasAppointmentConflict = existingAppointments.some((a) => {
          const aStart = new Date(a.scheduledAt).getTime();
          const aEnd = aStart + (a.durationMin || 30) * 60 * 1000;
          return sStart < aEnd && sEnd > aStart;
        });

        if (!hasConsultConflict && !hasAppointmentConflict) {
          slots.push({ startTime: slotStart, endTime: slotEnd });
        }

        currentMinutes += slotDuration;
      }
    }

    return slots;
  }

  async getDoctorPublicAgenda(doctorId: string) {
    // Returns weekly schedule (availability) for a doctor — visible to patients
    const availabilities = await this.prisma.doctorAvailability.findMany({
      where: { doctorId, isActive: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { id: true, firstName: true, lastName: true, specialty: true },
    });

    return { doctor, availabilities };
  }

  // ==================== CONFIDENTIAL DISCONNECT ====================

  async disconnectPatient(doctorUserId: string, patientId: string, reason?: string) {
    const doctor = await this.findByUserId(doctorUserId);

    const link = await this.prisma.patientDoctorLink.findFirst({
      where: { doctorId: doctor.id, patientId, status: 'ACTIVE' },
    });

    if (!link) throw new NotFoundException('Association non trouvee');

    // End the link silently — no notification to the patient
    return this.prisma.patientDoctorLink.update({
      where: { id: link.id },
      data: {
        status: 'ENDED',
        endedAt: new Date(),
        endedReason: reason || 'Deconnexion par le medecin',
      },
    });
  }

  // ==================== AVAILABILITY CHECK ====================

  async isDoctorAvailableToday(doctorId: string): Promise<boolean> {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0-6

    // Check if doctor has any active availability for today's day of week
    const availabilities = await this.prisma.doctorAvailability.findMany({
      where: { doctorId, dayOfWeek, isActive: true },
    });

    if (availabilities.length === 0) return false;

    // Check for full-day unavailability on today's date
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);

    const unavailability = await this.prisma.doctorUnavailability.findFirst({
      where: {
        doctorId,
        date: todayStart,
        startTime: null, // full-day unavailability
      },
    });

    if (unavailability) return false;

    return true;
  }

  // ==================== PROFILE PHOTO ====================

  async uploadProfilePhoto(userId: string, file: Express.Multer.File) {
    const doctor = await this.findByUserId(userId);

    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const filename = `${uuidv4()}${ext}`;
    const storagePath = `profile-photos/doctors/${doctor.id}/${filename}`;

    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };
    const contentType = mimeMap[ext] || 'image/jpeg';

    await this.storage.uploadFile(storagePath, file.buffer, contentType);

    const profilePhotoUrl = `/doctors/profile/photo/${filename}`;

    await this.prisma.doctor.update({
      where: { id: doctor.id },
      data: { profilePhotoUrl },
    });

    return { profilePhotoUrl };
  }

  async getProfilePhotoStream(filename: string): Promise<NodeJS.ReadableStream> {
    const doctor = await this.prisma.doctor.findFirst({
      where: { profilePhotoUrl: `/doctors/profile/photo/${filename}` },
    });

    if (!doctor) {
      throw new NotFoundException('Photo not found');
    }

    const storagePath = `profile-photos/doctors/${doctor.id}/${filename}`;
    return this.storage.getFileStream(storagePath);
  }

  // ==================== SIGNATURE & STAMP ====================

  async uploadSignature(userId: string, file: Express.Multer.File) {
    const doctor = await this.findByUserId(userId);

    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const filename = `${uuidv4()}${ext}`;
    const storagePath = `signatures/doctors/${doctor.id}/${filename}`;

    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.png': 'image/png', '.webp': 'image/webp',
    };
    const contentType = mimeMap[ext] || 'image/png';

    await this.storage.uploadFile(storagePath, file.buffer, contentType);

    await this.prisma.doctor.update({
      where: { id: doctor.id },
      data: { signatureImageUrl: storagePath },
    });

    return { signatureImageUrl: storagePath };
  }

  async uploadStamp(userId: string, file: Express.Multer.File) {
    const doctor = await this.findByUserId(userId);

    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const filename = `${uuidv4()}${ext}`;
    const storagePath = `stamps/doctors/${doctor.id}/${filename}`;

    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.png': 'image/png', '.webp': 'image/webp',
    };
    const contentType = mimeMap[ext] || 'image/png';

    await this.storage.uploadFile(storagePath, file.buffer, contentType);

    await this.prisma.doctor.update({
      where: { id: doctor.id },
      data: { stampImageUrl: storagePath },
    });

    return { stampImageUrl: storagePath };
  }

  async getSignatureBuffer(doctorId: string): Promise<Buffer | null> {
    const doctor = await this.prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor?.signatureImageUrl) return null;
    try {
      const stream = await this.storage.getFileStream(doctor.signatureImageUrl);
      const chunks: Buffer[] = [];
      return new Promise((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', () => resolve(null));
      });
    } catch {
      return null;
    }
  }

  async getStampBuffer(doctorId: string): Promise<Buffer | null> {
    const doctor = await this.prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor?.stampImageUrl) return null;
    try {
      const stream = await this.storage.getFileStream(doctor.stampImageUrl);
      const chunks: Buffer[] = [];
      return new Promise((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', () => resolve(null));
      });
    } catch {
      return null;
    }
  }

  async getFileStream(type: 'signatures' | 'stamps', filename: string): Promise<NodeJS.ReadableStream> {
    const field = type === 'signatures' ? 'signatureImageUrl' : 'stampImageUrl';
    const doctor = await this.prisma.doctor.findFirst({
      where: { [field]: { endsWith: filename } },
    });
    if (!doctor) {
      throw new NotFoundException(`${type === 'signatures' ? 'Signature' : 'Cachet'} non trouve`);
    }
    const storagePath = doctor[field as keyof typeof doctor] as string;
    return this.storage.getFileStream(storagePath);
  }

  // ==================== CONSULTATION STATISTICS ====================

  async getConsultationStats(userId: string) {
    const doctor = await this.findByUserId(userId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    const now = new Date();

    // Today: midnight to midnight
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // This week: Monday to Sunday
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // This month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // This quarter
    const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
    const quarterStart = new Date(now.getFullYear(), quarterMonth, 1);
    const quarterEnd = new Date(now.getFullYear(), quarterMonth + 3, 0, 23, 59, 59, 999);

    const baseWhere = { doctorId: doctor.id, status: 'ENDED' as const };

    const [today, thisWeek, thisMonth, thisQuarter] = await Promise.all([
      this.prisma.teleconsultation.count({
        where: { ...baseWhere, endedAt: { gte: todayStart, lte: todayEnd } },
      }),
      this.prisma.teleconsultation.count({
        where: { ...baseWhere, endedAt: { gte: weekStart, lte: weekEnd } },
      }),
      this.prisma.teleconsultation.count({
        where: { ...baseWhere, endedAt: { gte: monthStart, lte: monthEnd } },
      }),
      this.prisma.teleconsultation.count({
        where: { ...baseWhere, endedAt: { gte: quarterStart, lte: quarterEnd } },
      }),
    ]);

    // Send email report (fire-and-forget)
    if (user?.email) {
      const rawName = `${doctor.firstName} ${doctor.lastName}`.trim();
      const doctorName = rawName.startsWith('Dr.') ? rawName : `Dr. ${rawName}`;
      const dateStr = now.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      this.emailService.sendTemplate(
        user.email,
        `T-Cardio Pro: Rapport de consultations - ${doctorName}`,
        'consultation-stats',
        {
          doctorName,
          date: dateStr,
          today,
          thisWeek,
          thisMonth,
          thisQuarter,
          consultationPrice: doctor.consultationPriceXof ?? 'Non defini',
          durationMinutes: doctor.defaultDurationMinutes,
        },
      ).catch(() => {});
    }

    return {
      today,
      thisWeek,
      thisMonth,
      thisQuarter,
      consultationPriceXof: doctor.consultationPriceXof,
      defaultDurationMinutes: doctor.defaultDurationMinutes,
    };
  }
}
