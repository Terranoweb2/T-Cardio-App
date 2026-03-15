import { Injectable, Logger, NotFoundException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { PrescriptionPdfService } from './prescription-pdf.service';
import { StorageService } from '../storage/storage.service';
import { EmailService } from '../../core/email/email.service';
import { DoctorsService } from '../doctors/doctors.service';
import * as fs from 'fs';
import * as path from 'path';

interface CreatePrescriptionDto {
  patientId: string;
  teleconsultationId?: string;
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    notes?: string;
  }>;
  notes?: string;
}

@Injectable()
export class PrescriptionsService {
  private readonly logger = new Logger(PrescriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PrescriptionPdfService,
    private readonly storageService: StorageService,
    private readonly emailService: EmailService,
    private readonly doctorsService: DoctorsService,
  ) {}

  async create(doctorUserId: string, dto: CreatePrescriptionDto) {
    // Get doctor
    const doctor = await this.prisma.doctor.findUnique({ where: { userId: doctorUserId } });
    if (!doctor) throw new NotFoundException('Medecin introuvable');

    // Verify link to patient
    const link = await this.prisma.patientDoctorLink.findFirst({
      where: { patientId: dto.patientId, doctorId: doctor.id, status: 'ACTIVE' },
    });
    if (!link) throw new ForbiddenException('Aucun lien actif avec ce patient');

    // Get patient info for PDF
    const patient = await this.prisma.patient.findUnique({
      where: { id: dto.patientId },
    });
    if (!patient) throw new NotFoundException('Patient introuvable');

    // Calculate age
    let patientAge: number | null = null;
    if (patient.birthDate) {
      const today = new Date();
      const birth = new Date(patient.birthDate);
      patientAge = today.getFullYear() - birth.getFullYear();
    }

    const patientName = [patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'Patient';

    // Build doctor display name (avoid "Dr. Dr." if firstName already contains "Dr.")
    const rawDoctorName = `${doctor.firstName} ${doctor.lastName}`.trim();
    const doctorDisplayName = rawDoctorName.startsWith('Dr.') ? rawDoctorName : `Dr. ${rawDoctorName}`;

    // Create prescription record
    const prescription = await this.prisma.prescription.create({
      data: {
        doctorId: doctor.id,
        patientId: dto.patientId,
        teleconsultationId: dto.teleconsultationId,
        medications: dto.medications as any,
        notes: dto.notes,
        signedBy: doctorDisplayName,
        signedAt: new Date(),
        rppsNumber: doctor.rppsNumber,
      },
    });

    // Load doctor signature & stamp images
    const [signatureImage, stampImage] = await Promise.all([
      this.doctorsService.getSignatureBuffer(doctor.id).catch(() => null),
      this.doctorsService.getStampBuffer(doctor.id).catch(() => null),
    ]);

    // Generate PDF
    let pdfUrl: string | null = null;
    let pdfBuffer: Buffer | null = null;
    try {
      pdfBuffer = await this.pdfService.generatePrescription({
        doctorName: rawDoctorName,
        rppsNumber: doctor.rppsNumber,
        doctorSpecialty: doctor.specialty,
        patientName,
        patientAge,
        medications: dto.medications,
        notes: dto.notes,
        date: new Date(),
        signatureImage,
        stampImage,
      });

      // Validate PDF
      if (!pdfBuffer || pdfBuffer.length < 500) {
        throw new Error(`PDF trop petit: ${pdfBuffer?.length || 0} octets`);
      }

      // Upload to MinIO
      const fileName = `prescriptions/${prescription.id}.pdf`;
      await this.storageService.uploadToPath(
        'tcardio-reports',
        fileName,
        pdfBuffer,
        'application/pdf',
      );
      pdfUrl = fileName;

      this.logger.log(`Ordonnance PDF generee: ${fileName} (${pdfBuffer.length} octets)`);
    } catch (error) {
      this.logger.error(`PDF generation/upload failed for prescription ${prescription.id}: ${error.message}`, error.stack);
      // Don't silently ignore — propagate error so caller knows PDF failed
      throw new InternalServerErrorException(`Erreur lors de la generation du PDF: ${error.message}`);
    }

    // Update prescription with PDF URL (even if null for transparency)
    const updated = await this.prisma.prescription.update({
      where: { id: prescription.id },
      data: { pdfUrl },
    });

    // ── Notify patient: in-app alert + email with PDF ──
    try {
      const doctorName = doctorDisplayName;
      const medList = dto.medications.map((m) => m.name).join(', ');

      // In-app alert
      await this.prisma.alert.create({
        data: {
          patientId: dto.patientId,
          doctorId: doctor.id,
          type: 'SYSTEM',
          title: 'Nouvelle ordonnance',
          message: `${doctorName} vous a prescrit une ordonnance : ${medList}. Consultez vos ordonnances pour la telecharger.`,
          severity: 'FAIBLE',
        },
      });

      // Email with PDF attachment using modern template
      const patientUser = await this.prisma.user.findUnique({ where: { id: patient.userId } });
      if (patientUser?.email && pdfBuffer) {
        // Build medications HTML list
        const medicationsHtml = dto.medications.map((m) =>
          `<div style="background:#ffffff;border:1px solid #e9d5ff;border-radius:10px;padding:14px 16px;margin-bottom:8px;">
            <p style="margin:0 0 4px;color:#1e1b4b;font-size:14px;font-weight:700;">${m.name}</p>
            <p style="margin:0;color:#6b7280;font-size:12px;">
              &#128137; ${m.dosage} &nbsp;&bull;&nbsp; ${m.frequency} &nbsp;&bull;&nbsp; ${m.duration}
            </p>
            ${m.notes ? `<p style="margin:4px 0 0;color:#9ca3af;font-size:11px;font-style:italic;">Note : ${m.notes}</p>` : ''}
          </div>`,
        ).join('');

        const notesHtml = dto.notes
          ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;margin-bottom:16px;">
              <p style="margin:0 0 4px;color:#92400e;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">&#128221; Instructions</p>
              <p style="margin:0;color:#78350f;font-size:13px;line-height:1.6;">${dto.notes}</p>
            </div>`
          : '';

        const dateStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

        // Load template
        let html: string;
        try {
          const tplPath = path.join(__dirname, '..', '..', 'core', 'email', 'templates', 'prescription-created.html');
          html = fs.readFileSync(tplPath, 'utf8');
        } catch {
          // Fallback: try production path
          html = fs.readFileSync(path.join('/app', 'dist', 'core', 'email', 'templates', 'prescription-created.html'), 'utf8');
        }

        html = html
          .replace(/\{\{patientName\}\}/g, patientName)
          .replace(/\{\{doctorName\}\}/g, doctorName)
          .replace(/\{\{doctorSpecialty\}\}/g, doctor.specialty || 'Medecin')
          .replace(/\{\{prescriptionDate\}\}/g, dateStr)
          .replace(/\{\{medicationsList\}\}/g, medicationsHtml)
          .replace(/\{\{notesSection\}\}/g, notesHtml);

        this.emailService
          .sendEmailWithAttachment(
            patientUser.email,
            `T-Cardio Pro: Nouvelle ordonnance de ${doctorName}`,
            html,
            [{ filename: 'ordonnance-tcardio.pdf', content: pdfBuffer, contentType: 'application/pdf' }],
          )
          .then((ok) => ok && this.logger.log(`Prescription email sent to patient ${patientUser.email}`))
          .catch((e) => this.logger.warn(`Failed to email prescription to patient: ${e.message}`));
      }

      this.logger.log(`Prescription notification sent for patient ${dto.patientId}`);
    } catch (err) {
      this.logger.warn(`Failed to notify patient about prescription: ${err.message}`);
    }

    return updated;
  }

  async findByDoctor(doctorUserId: string) {
    const doctor = await this.prisma.doctor.findUnique({ where: { userId: doctorUserId } });
    if (!doctor) return [];

    return this.prisma.prescription.findMany({
      where: { doctorId: doctor.id },
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { select: { firstName: true, lastName: true } },
      },
    });
  }

  async findByPatient(patientUserId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { userId: patientUserId } });
    if (!patient) return [];

    return this.prisma.prescription.findMany({
      where: { patientId: patient.id },
      orderBy: { createdAt: 'desc' },
      include: {
        doctor: { select: { firstName: true, lastName: true, specialty: true } },
      },
    });
  }

  // ==================== REGENERATE PDF ====================

  async regeneratePdf(prescriptionId: string, userId: string) {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        doctor: true,
        patient: true,
      },
    });

    if (!prescription) throw new NotFoundException('Ordonnance introuvable');

    // Only the doctor who created it (or admin) can regenerate
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.role === 'PATIENT') throw new ForbiddenException('Seul le medecin peut regenerer le PDF');
    if (user.role !== 'ADMIN' && prescription.doctor.userId !== userId) {
      throw new ForbiddenException('Vous n\'etes pas le medecin de cette ordonnance');
    }

    const doctor = prescription.doctor;
    const patient = prescription.patient;

    // Calculate patient age
    let patientAge: number | null = null;
    if (patient.birthDate) {
      const today = new Date();
      patientAge = today.getFullYear() - new Date(patient.birthDate).getFullYear();
    }

    const patientName = [patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'Patient';
    const rawDoctorName = `${doctor.firstName} ${doctor.lastName}`.trim();

    // Load signature & stamp
    const [signatureImage, stampImage] = await Promise.all([
      this.doctorsService.getSignatureBuffer(doctor.id).catch(() => null),
      this.doctorsService.getStampBuffer(doctor.id).catch(() => null),
    ]);

    // Generate PDF
    const medications = (prescription.medications as any[]) || [];
    const pdfBuffer = await this.pdfService.generatePrescription({
      doctorName: rawDoctorName,
      rppsNumber: doctor.rppsNumber,
      doctorSpecialty: doctor.specialty,
      patientName,
      patientAge,
      medications,
      notes: prescription.notes || undefined,
      date: prescription.createdAt,
      signatureImage,
      stampImage,
    });

    if (!pdfBuffer || pdfBuffer.length < 500) {
      throw new InternalServerErrorException('La regeneration du PDF a echoue');
    }

    // Upload to MinIO
    const fileName = `prescriptions/${prescription.id}.pdf`;
    await this.storageService.uploadToPath('tcardio-reports', fileName, pdfBuffer, 'application/pdf');

    // Update prescription record
    const updated = await this.prisma.prescription.update({
      where: { id: prescriptionId },
      data: { pdfUrl: fileName },
    });

    this.logger.log(`PDF regenere pour ordonnance ${prescriptionId} (${pdfBuffer.length} octets)`);
    return updated;
  }

  async getDownloadBuffer(prescriptionId: string, userId: string): Promise<Buffer> {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        patient: { select: { userId: true } },
        doctor: { select: { userId: true } },
      },
    });

    if (!prescription) throw new NotFoundException('Ordonnance introuvable');
    if (prescription.patient.userId !== userId && prescription.doctor.userId !== userId) {
      throw new ForbiddenException('Acces refuse');
    }
    if (!prescription.pdfUrl) throw new NotFoundException('PDF non disponible');

    return this.storageService.downloadBuffer('tcardio-reports', prescription.pdfUrl);
  }
}
