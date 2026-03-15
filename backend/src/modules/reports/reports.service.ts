import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { StorageService } from '../storage/storage.service';
import { EmailService } from '../../core/email/email.service';
import * as crypto from 'crypto';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly storage: StorageService,
    private readonly emailService: EmailService,
  ) {}

  async generateReport(data: {
    patientId: string;
    doctorId?: string;
    periodStart: string;
    periodEnd: string;
    reportType?: any;
    doctorNotes?: string;
  }) {
    const patient = await this.prisma.patient.findUnique({ where: { id: data.patientId } });
    if (!patient) throw new NotFoundException('Patient not found');

    // Get measurements for period
    const measurements = await this.prisma.bpMeasurement.findMany({
      where: {
        patientId: data.patientId,
        measuredAt: {
          gte: new Date(data.periodStart),
          lte: new Date(data.periodEnd),
        },
      },
      orderBy: { measuredAt: 'asc' },
    });

    // Get latest AI analysis
    const latestAi = await this.prisma.aiAnalysis.findFirst({
      where: { patientId: data.patientId, errorMessage: null },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate stats
    const systolics = measurements.map((m) => m.systolic);
    const diastolics = measurements.map((m) => m.diastolic);

    const age = patient.birthDate
      ? Math.floor((Date.now() - new Date(patient.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null;

    // Generate PDF
    const pdfBuffer = await this.pdfGenerator.generateReport({
      patientName: `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Patient',
      patientAge: age,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      measurements: measurements.map((m) => ({
        date: m.measuredAt.toISOString(),
        systolic: m.systolic,
        diastolic: m.diastolic,
        pulse: m.pulse || undefined,
      })),
      stats: {
        systolicAvg: systolics.length > 0 ? Math.round(systolics.reduce((a, b) => a + b, 0) / systolics.length) : 0,
        diastolicAvg: diastolics.length > 0 ? Math.round(diastolics.reduce((a, b) => a + b, 0) / diastolics.length) : 0,
        count: measurements.length,
      },
      aiSummaryPatient: latestAi?.patientSummary || undefined,
      aiSummaryDoctor: latestAi?.doctorSummary || undefined,
      riskLevel: latestAi?.riskLevel || undefined,
      doctorNotes: data.doctorNotes,
    });

    // Upload to storage
    const fileName = `reports/${data.patientId}/${Date.now()}_report.pdf`;
    const filePath = await this.storage.uploadFile(fileName, pdfBuffer);
    const fileHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

    // Save record
    const report = await this.prisma.report.create({
      data: {
        patientId: data.patientId,
        doctorId: data.doctorId,
        periodStart: new Date(data.periodStart),
        periodEnd: new Date(data.periodEnd),
        reportType: data.reportType || 'MENSUEL',
        title: `Rapport ${data.periodStart} - ${data.periodEnd}`,
        summary: latestAi?.doctorSummary?.substring(0, 500),
        filePath,
        fileSizeBytes: pdfBuffer.length,
        fileHash,
      },
    });

    // Notify all linked doctors that a new report is available
    try {
      const doctorLinks = await this.prisma.patientDoctorLink.findMany({
        where: { patientId: data.patientId, status: 'ACTIVE' },
      });

      const patientName = `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Patient';
      const periodStartFr = new Date(data.periodStart).toLocaleDateString('fr-FR');
      const periodEndFr = new Date(data.periodEnd).toLocaleDateString('fr-FR');

      for (const link of doctorLinks) {
        await this.prisma.alert.create({
          data: {
            patientId: data.patientId,
            doctorId: link.doctorId,
            type: 'REPORT',
            title: 'Nouveau rapport disponible',
            message: `${patientName} a genere un rapport pour la periode du ${periodStartFr} au ${periodEndFr}. ${measurements.length} mesures analysees.`,
            severity: 'FAIBLE',
          },
        });
      }

      if (doctorLinks.length > 0) {
        this.logger.log(`Report notification sent to ${doctorLinks.length} doctor(s) for patient ${data.patientId}`);
      }
    } catch (err) {
      this.logger.warn(`Failed to notify doctors about report: ${err.message}`);
    }

    // ── Send report emails (patient + doctors) ──
    try {
      const stats = {
        systolicAvg: systolics.length > 0 ? Math.round(systolics.reduce((a, b) => a + b, 0) / systolics.length) : 0,
        diastolicAvg: diastolics.length > 0 ? Math.round(diastolics.reduce((a, b) => a + b, 0) / diastolics.length) : 0,
      };
      const patientName = `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Patient';
      const periodStartFr = new Date(data.periodStart).toLocaleDateString('fr-FR');
      const periodEndFr = new Date(data.periodEnd).toLocaleDateString('fr-FR');

      const reportEmailData = {
        periodStart: periodStartFr,
        periodEnd: periodEndFr,
        measurementCount: measurements.length,
        avgSystolic: stats.systolicAvg,
        avgDiastolic: stats.diastolicAvg,
        riskLevel: latestAi?.riskLevel || 'FAIBLE',
        aiSummary: latestAi?.patientSummary || undefined,
      };

      // Email to patient
      const patientUser = await this.prisma.user.findUnique({ where: { id: patient.userId } });
      if (patientUser?.email) {
        this.emailService
          .sendReportEmail(patientUser.email, patientName, patientName, reportEmailData, pdfBuffer, false)
          .then((ok) => ok && this.logger.log(`Report email sent to patient ${patientUser.email}`))
          .catch((e) => this.logger.warn(`Failed to email report to patient: ${e.message}`));
      }

      // Emails to linked doctors
      const doctorLinks = await this.prisma.patientDoctorLink.findMany({
        where: { patientId: data.patientId, status: 'ACTIVE' },
        include: { doctor: { include: { user: true } } },
      });

      for (const link of doctorLinks) {
        const doc = link.doctor;
        const docEmail = doc?.user?.email;
        if (!docEmail) continue;

        const docName = `Dr. ${doc.firstName || ''} ${doc.lastName || ''}`.trim();
        const doctorReportData = {
          ...reportEmailData,
          aiSummary: latestAi?.doctorSummary || latestAi?.patientSummary || undefined,
        };

        this.emailService
          .sendReportEmail(docEmail, docName, patientName, doctorReportData, pdfBuffer, true)
          .then((ok) => ok && this.logger.log(`Report email sent to doctor ${docEmail}`))
          .catch((e) => this.logger.warn(`Failed to email report to doctor ${docEmail}: ${e.message}`));
      }
    } catch (err) {
      this.logger.warn(`Failed to send report emails: ${err.message}`);
    }

    return report;
  }

  /**
   * Generate a complete medical file PDF containing all patient data
   */
  async generateCompleteMedicalFile(patientId: string): Promise<Buffer> {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      include: { user: { select: { email: true } } },
    });
    if (!patient) throw new NotFoundException('Patient non trouve');

    const age = patient.birthDate
      ? Math.floor((Date.now() - new Date(patient.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null;

    // Gather all data in parallel
    const [
      measurements,
      teleconsultations,
      medications,
      examResults,
      riskScores,
      prescriptions,
      latestAi,
    ] = await Promise.all([
      this.prisma.bpMeasurement.findMany({
        where: { patientId },
        orderBy: { measuredAt: 'desc' },
        take: 200,
      }),
      this.prisma.teleconsultation.findMany({
        where: { patientId },
        include: { doctor: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.medication.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.examResult.findMany({
        where: { patientId },
        orderBy: { uploadedAt: 'desc' },
        take: 50,
      }),
      this.prisma.cardioRiskScore.findMany({
        where: { patientId },
        orderBy: { calculatedAt: 'desc' },
        take: 10,
      }),
      this.prisma.prescription.findMany({
        where: { patientId },
        include: { doctor: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.prisma.aiAnalysis.findFirst({
        where: { patientId, errorMessage: null },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Calculate measurement stats
    const systolics = measurements.map(m => m.systolic);
    const diastolics = measurements.map(m => m.diastolic);
    const stats = {
      systolicAvg: systolics.length > 0 ? Math.round(systolics.reduce((a, b) => a + b, 0) / systolics.length) : 0,
      diastolicAvg: diastolics.length > 0 ? Math.round(diastolics.reduce((a, b) => a + b, 0) / diastolics.length) : 0,
      count: measurements.length,
    };

    // Build the complete medical file PDF
    return this.pdfGenerator.generateCompleteMedicalFile({
      patientName: `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Patient',
      patientAge: age,
      patientEmail: (patient as any).user?.email,
      patientGender: patient.gender || undefined,
      patientHeight: patient.heightCm,
      patientWeight: patient.weightKg ? Number(patient.weightKg) : null,
      medicalStatus: patient.medicalStatus,
      generatedAt: new Date().toISOString(),
      measurements: measurements.map(m => ({
        date: m.measuredAt.toISOString(),
        systolic: m.systolic,
        diastolic: m.diastolic,
        pulse: m.pulse || undefined,
        context: m.context,
        riskLevel: m.riskLevel || undefined,
      })),
      stats,
      teleconsultations: teleconsultations.map(tc => ({
        date: (tc.scheduledAt || tc.createdAt).toISOString(),
        status: tc.status as string,
        reason: tc.reason || undefined,
        summary: tc.summary || undefined,
        doctorName: tc.doctor ? `Dr. ${tc.doctor.firstName} ${tc.doctor.lastName}` : 'N/A',
      })),
      medications: medications.map(med => ({
        name: med.name,
        dosage: med.dosage || undefined,
        frequency: med.frequency as string,
        startDate: med.startDate.toISOString(),
        endDate: med.endDate?.toISOString(),
        isActive: med.isActive,
      })),
      examResults: examResults.map(ex => ({
        type: ex.type as string,
        title: ex.title || undefined,
        date: ex.uploadedAt.toISOString(),
        notes: ex.notes || undefined,
        doctorComment: ex.doctorComment || undefined,
      })),
      riskScores: riskScores.map(rs => ({
        score: rs.score,
        riskLevel: rs.riskLevel,
        algorithm: rs.algorithm,
        date: rs.calculatedAt.toISOString(),
      })),
      prescriptions: prescriptions.map(p => ({
        date: p.createdAt.toISOString(),
        medications: p.medications as any,
        doctorName: p.doctor ? `Dr. ${p.doctor.firstName} ${p.doctor.lastName}` : 'N/A',
        notes: p.notes || undefined,
      })),
      aiSummary: latestAi?.patientSummary || undefined,
      riskLevel: latestAi?.riskLevel || undefined,
    });
  }

  async findByPatient(patientId: string) {
    return this.prisma.report.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByDoctor(doctorId: string) {
    return this.prisma.report.findMany({
      where: { doctorId },
      include: { patient: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDownloadUrl(reportId: string, userId: string) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');

    // Increment download count
    await this.prisma.report.update({
      where: { id: reportId },
      data: {
        downloadCount: { increment: 1 },
        lastDownloadedAt: new Date(),
      },
    });

    const fileName = report.filePath.replace(`${process.env.MINIO_BUCKET || 'tcardio-reports'}/`, '');
    return this.storage.getPresignedUrl(fileName, 3600);
  }

  async getFileBuffer(reportId: string, userId: string): Promise<Buffer> {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');

    // Increment download count
    await this.prisma.report.update({
      where: { id: reportId },
      data: {
        downloadCount: { increment: 1 },
        lastDownloadedAt: new Date(),
      },
    });

    const fileName = report.filePath.replace(`${process.env.MINIO_BUCKET || 'tcardio-reports'}/`, '');
    const stream = await this.storage.getFileStream(fileName);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async signReport(reportId: string, doctorUserId: string) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');
    if (report.signedAt) throw new BadRequestException('Report already signed');

    const doctor = await this.prisma.doctor.findUnique({ where: { userId: doctorUserId } });
    if (!doctor) throw new NotFoundException('Doctor not found');

    // Check the report belongs to this doctor
    if (report.doctorId && report.doctorId !== doctor.id) {
      throw new BadRequestException('You can only sign your own reports');
    }

    // Update report with signature
    const updated = await this.prisma.report.update({
      where: { id: reportId },
      data: {
        signedBy: doctorUserId,
        signedAt: new Date(),
      },
    });

    // Try to add signature to PDF
    try {
      const doctorName = `Dr. ${doctor.firstName || ''} ${doctor.lastName || ''}`.trim();
      const fileName = report.filePath.replace(`${process.env.MINIO_BUCKET || 'tcardio-reports'}/`, '');

      // Get existing PDF
      const pdfStream = await this.storage.getFileStream(fileName);
      const chunks: Buffer[] = [];
      for await (const chunk of pdfStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const pdfBuffer = Buffer.concat(chunks);

      // Add signature to PDF
      const signedPdf = await this.pdfGenerator.addSignature(pdfBuffer, doctorName, new Date());

      // Re-upload
      await this.storage.uploadFile(fileName, signedPdf, 'application/pdf');
    } catch (err) {
      // Signature was saved in DB even if PDF modification fails
      console.warn(`Failed to add signature to PDF: ${err}`);
    }

    return updated;
  }
}
