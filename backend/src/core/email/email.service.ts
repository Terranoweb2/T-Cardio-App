import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly fromAddress: string;
  private readonly isConfigured: boolean;
  private smtpVerified = false;

  private readonly maxRetries = 3;
  private readonly retryDelayMs = 2_000;

  // SMTP config stored for reconnect
  private readonly smtpHost: string;
  private readonly smtpPort: number;
  private readonly smtpUser: string;
  private readonly smtpPass: string;

  // Brevo API fallback (port 443 — never blocked by cloud providers)
  private readonly brevoApiKey: string;
  private readonly senderName: string;
  private readonly senderEmail: string;

  // Template cache to avoid repeated disk reads
  private templateCache: Map<string, string> = new Map();

  constructor(private readonly configService: ConfigService) {
    this.smtpHost = this.configService.get<string>('SMTP_HOST') || '';
    this.smtpPort = this.configService.get<number>('SMTP_PORT') || 587;
    this.smtpUser = this.configService.get<string>('SMTP_USER') || '';
    this.smtpPass = this.configService.get<string>('SMTP_PASS') || '';
    this.brevoApiKey = this.configService.get<string>('BREVO_API_KEY') || '';
    this.senderName = this.configService.get<string>('EMAIL_SENDER_NAME') || 'T-Cardio Pro';
    this.senderEmail = this.configService.get<string>('EMAIL_SENDER_EMAIL') || 'noreply@t-cardio.com';
    this.fromAddress =
      this.configService.get<string>('SMTP_FROM') ||
      `${this.senderName} <${this.senderEmail}>`;

    this.isConfigured = !!this.smtpHost || !!this.brevoApiKey;

    if (this.isConfigured) {
      this.createTransporter();
      this.logger.log(`Email transport configured for ${this.smtpHost}:${this.smtpPort}`);
    } else {
      this.logger.warn('SMTP_HOST not configured. Email sending is disabled.');
    }
  }

  /**
   * Create (or recreate) the Nodemailer transporter with connection pooling and timeouts.
   */
  private createTransporter(): void {
    this.transporter = nodemailer.createTransport({
      host: this.smtpHost,
      port: this.smtpPort,
      secure: this.smtpPort === 465,
      auth:
        this.smtpUser && this.smtpPass
          ? { user: this.smtpUser, pass: this.smtpPass }
          : undefined,
      tls: { rejectUnauthorized: false },
      // Connection pool — reuses connections
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
      // Timeouts to avoid hanging forever
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    });

    this.smtpVerified = false;
  }

  /**
   * Verify SMTP connectivity at startup — logs result but NEVER blocks the application.
   */
  async onModuleInit(): Promise<void> {
    if (!this.isConfigured || !this.transporter) return;

    try {
      await this.transporter.verify();
      this.smtpVerified = true;
      this.logger.log(
        `SMTP connection VERIFIED — ${this.smtpHost}:${this.smtpPort} (user: ${this.smtpUser})`,
      );
    } catch (err) {
      this.smtpVerified = false;
      this.logger.error(
        `SMTP verification FAILED (will retry on first send): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Ensure the transporter is alive. If not, recreate it.
   */
  private async ensureTransporter(): Promise<boolean> {
    if (!this.isConfigured) return false;

    // If already verified, return immediately
    if (this.smtpVerified && this.transporter) return true;

    // Try to verify the existing transporter
    if (this.transporter) {
      try {
        await this.transporter.verify();
        this.smtpVerified = true;
        return true;
      } catch {
        this.logger.warn('SMTP connection lost — recreating transporter...');
      }
    }

    // Recreate transporter and verify
    this.createTransporter();
    try {
      await this.transporter!.verify();
      this.smtpVerified = true;
      this.logger.log('SMTP transporter reconnected successfully');
      return true;
    } catch (err) {
      this.smtpVerified = false;
      this.logger.error(
        `SMTP reconnect failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  /**
   * Sleep helper for retry delays.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Send a raw email with HTML content.
   * Retries up to maxRetries times with exponential backoff.
   * NEVER throws — always returns true/false.
   */
  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    return this.sendEmailWithAttachment(to, subject, html);
  }

  /**
   * Send an email with HTML content and optional attachments.
   * Retries up to maxRetries times with exponential backoff.
   * NEVER throws — always returns true/false.
   */
  async sendEmailWithAttachment(
    to: string,
    subject: string,
    html: string,
    attachments?: Array<{ filename: string; content: Buffer; contentType: string }>,
  ): Promise<boolean> {
    if (!this.isConfigured) {
      this.logger.debug(
        `Email skipped (SMTP not configured): to=${to}, subject="${subject}"`,
      );
      return false;
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Ensure connection is alive before sending
        const ready = await this.ensureTransporter();
        if (!ready || !this.transporter) {
          this.logger.warn(`Email attempt ${attempt}/${this.maxRetries} — transporter not ready`);
          if (attempt < this.maxRetries) {
            await this.sleep(this.retryDelayMs * attempt);
            continue;
          }
          return false;
        }

        const mailOptions: any = {
          from: this.fromAddress,
          to,
          subject,
          html,
        };

        if (attachments && attachments.length > 0) {
          mailOptions.attachments = attachments;
        }

        const info = await this.transporter.sendMail(mailOptions);

        this.logger.log(
          `Email sent: to=${to}, subject="${subject}", messageId=${info.messageId}${attachments ? `, attachments=${attachments.length}` : ''}`,
        );
        return true;
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Email attempt ${attempt}/${this.maxRetries} failed: to=${to} — ${errMsg}`,
        );

        // On connection/auth errors, mark as unverified so next attempt reconnects
        this.smtpVerified = false;

        if (attempt < this.maxRetries) {
          await this.sleep(this.retryDelayMs * attempt);
        } else {
          this.logger.error(
            `Email SMTP FAILED after ${this.maxRetries} attempts: to=${to}, subject="${subject}"`,
          );
        }
      }
    }

    // ─── Fallback: Brevo API (HTTPS port 443 — never blocked) ───
    if (this.brevoApiKey) {
      return this.sendViaBrevoApi(to, subject, html, attachments);
    }

    return false;
  }

  /**
   * Send email via Brevo (Sendinblue) HTTP API.
   * Used as fallback when SMTP is blocked by cloud providers (DigitalOcean, AWS, etc.)
   */
  private async sendViaBrevoApi(
    to: string,
    subject: string,
    html: string,
    attachments?: Array<{ filename: string; content: Buffer; contentType: string }>,
  ): Promise<boolean> {
    try {
      const payload: any = {
        sender: { name: this.senderName, email: this.senderEmail },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      };

      // Add attachments as base64
      if (attachments && attachments.length > 0) {
        payload.attachment = attachments.map((a) => ({
          name: a.filename,
          content: a.content.toString('base64'),
        }));
      }

      const response = await axios.post(
        'https://api.brevo.com/v3/smtp/email',
        payload,
        {
          headers: {
            'api-key': this.brevoApiKey,
            'Content-Type': 'application/json',
          },
          timeout: 30_000,
        },
      );

      this.logger.log(
        `Email sent via Brevo API: to=${to}, subject="${subject}", messageId=${response.data?.messageId || 'ok'}`,
      );
      return true;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Brevo API email FAILED: to=${to} — ${errMsg}`);
      return false;
    }
  }

  /**
   * Send an email using an HTML template file with {{variable}} replacements.
   * Templates are cached in memory after first load.
   */
  async sendTemplate(
    to: string,
    subject: string,
    templateName: string,
    variables: Record<string, string | number>,
  ): Promise<boolean> {
    try {
      let html = this.templateCache.get(templateName);

      if (!html) {
        const templatePath = path.join(
          __dirname,
          'templates',
          `${templateName}.html`,
        );

        if (!fs.existsSync(templatePath)) {
          this.logger.error(
            `Email template "${templateName}" not found at ${templatePath}`,
          );
          return false;
        }

        html = fs.readFileSync(templatePath, 'utf-8');
        this.templateCache.set(templateName, html);
        this.logger.debug(`Template "${templateName}" loaded and cached`);
      }

      // Replace variables — work on a copy so cache stays clean
      let rendered = html;
      for (const [key, value] of Object.entries(variables)) {
        const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        rendered = rendered.replace(placeholder, String(value));
      }

      return this.sendEmail(to, subject, rendered);
    } catch (error) {
      this.logger.error(
        `Failed to render template "${templateName}": ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Convenience methods
  // ---------------------------------------------------------------------------

  /**
   * Send an emergency blood pressure alert to a doctor or contact.
   */
  async sendEmergencyAlert(
    toEmail: string,
    patientName: string,
    systolic: number,
    diastolic: number,
  ): Promise<boolean> {
    return this.sendTemplate(
      toEmail,
      `URGENT: Emergency BP Alert for ${patientName}`,
      'emergency-alert',
      { patientName, systolic, diastolic },
    );
  }

  /**
   * Send a welcome email to a new user.
   */
  async sendWelcome(toEmail: string, userName: string): Promise<boolean> {
    return this.sendTemplate(toEmail, 'Welcome to T-Cardio Pro', 'welcome', {
      userName,
    });
  }

  /**
   * Notify a doctor about their verification status change.
   */
  async sendDoctorVerified(
    toEmail: string,
    doctorName: string,
    status: string,
  ): Promise<boolean> {
    return this.sendTemplate(
      toEmail,
      `T-Cardio Pro: Doctor Verification ${status === 'approved' ? 'Approved' : 'Update'}`,
      'doctor-verified',
      { doctorName, status },
    );
  }

  /**
   * Send an emergency call alert email to a doctor.
   */
  async sendEmergencyCallAlert(
    toEmail: string,
    patientName: string,
    emergencyType: 'free' | 'paid',
    teleconsultationId: string,
    attemptNumber: number = 1,
  ): Promise<boolean> {
    const emergencyLabel = emergencyType === 'paid' ? 'Urgence payante (insistant)' : 'Urgence gratuite';
    const callTime = new Date().toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return this.sendTemplate(
      toEmail,
      `URGENCE T-CARDIO: ${patientName} demande un appel d'urgence`,
      'emergency-call',
      { patientName, emergencyLabel, callTime, teleconsultationId, attemptNumber },
    );
  }

  /**
   * Remind a patient to take their blood pressure measurement.
   */
  async sendMeasurementReminder(
    toEmail: string,
    patientName: string,
    daysSinceLastMeasure: number = 0,
  ): Promise<boolean> {
    return this.sendTemplate(
      toEmail,
      'T-Cardio Pro: Time to Check Your Blood Pressure',
      'measurement-reminder',
      { patientName, daysSinceLastMeasure },
    );
  }

  /**
   * Send a weekly summary of a patient's measurements.
   *
   * Supports two calling conventions:
   *   sendWeeklySummary(to, name, avgSys, avgDia, count, risk)
   *   sendWeeklySummary(to, name, statsObject)
   */
  async sendWeeklySummary(
    toEmail: string,
    patientName: string,
    avgSystolicOrStats: number | Record<string, any>,
    avgDiastolic?: number,
    measurementCount?: number,
    riskLevel?: string,
  ): Promise<boolean> {
    let variables: Record<string, string | number>;

    if (typeof avgSystolicOrStats === 'object' && avgSystolicOrStats !== null) {
      // Called with a stats object: sendWeeklySummary(to, name, stats)
      const stats = avgSystolicOrStats;
      variables = {
        patientName,
        avgSystolic: stats.avgSystolic ?? 0,
        avgDiastolic: stats.avgDiastolic ?? 0,
        measurementCount: stats.totalMeasurements ?? stats.measurementCount ?? 0,
        riskLevel: stats.riskLevel ?? 'N/A',
      };
    } else {
      // Called with individual args: sendWeeklySummary(to, name, sys, dia, count, risk)
      variables = {
        patientName,
        avgSystolic: avgSystolicOrStats,
        avgDiastolic: avgDiastolic ?? 0,
        measurementCount: measurementCount ?? 0,
        riskLevel: riskLevel ?? 'N/A',
      };
    }

    // ── Build enriched sections HTML (only if data exists) ──
    let enrichedSectionsHtml = '';

    if (typeof avgSystolicOrStats === 'object' && avgSystolicOrStats !== null) {
      const stats = avgSystolicOrStats;

      // Medication adherence section
      if (stats.medicationAdherence != null) {
        const adherenceColor = stats.medicationAdherence >= 80 ? '#16a34a' : stats.medicationAdherence >= 50 ? '#ca8a04' : '#dc2626';
        enrichedSectionsHtml += `
          <div style="background:#f8fafc;border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid #e2e8f0;">
            <p style="margin:0 0 8px;font-size:13px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Observance medicamenteuse</p>
            <p style="margin:0;font-size:24px;font-weight:700;color:${adherenceColor};">${stats.medicationAdherence}%</p>
            <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">des prises respectees cette semaine</p>
          </div>`;
      }

      // Upcoming appointments section
      if (stats.upcomingAppointments && stats.upcomingAppointments.length > 0) {
        const apptItems = stats.upcomingAppointments.map((appt: any) => {
          const date = new Date(appt.scheduledAt).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
          const statusLabel = appt.status === 'APPT_CONFIRMED' ? 'Confirme' : 'En attente';
          return `<li style="padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#374151;">${date} — <span style="color:${appt.status === 'APPT_CONFIRMED' ? '#16a34a' : '#ca8a04'};font-size:12px;">${statusLabel}</span></li>`;
        }).join('');

        enrichedSectionsHtml += `
          <div style="background:#f8fafc;border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid #e2e8f0;">
            <p style="margin:0 0 8px;font-size:13px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Prochains rendez-vous</p>
            <ul style="list-style:none;padding:0;margin:0;">${apptItems}</ul>
          </div>`;
      }

      // Risk score evolution section
      if (stats.riskScoreLatest) {
        let riskTrend = '';
        if (stats.riskScorePrevious) {
          const diff = (stats.riskScoreLatest.overallScore ?? 0) - (stats.riskScorePrevious.overallScore ?? 0);
          if (diff > 0) riskTrend = `<span style="color:#dc2626;font-size:13px;"> (+${diff.toFixed(1)} pts)</span>`;
          else if (diff < 0) riskTrend = `<span style="color:#16a34a;font-size:13px;"> (${diff.toFixed(1)} pts)</span>`;
          else riskTrend = `<span style="color:#64748b;font-size:13px;"> (stable)</span>`;
        }
        enrichedSectionsHtml += `
          <div style="background:#f8fafc;border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid #e2e8f0;">
            <p style="margin:0 0 8px;font-size:13px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Score de risque cardiovasculaire</p>
            <p style="margin:0;font-size:20px;font-weight:700;color:#374151;">${stats.riskScoreLatest.overallScore ?? 'N/A'}${riskTrend}</p>
            <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">Calcule le ${new Date(stats.riskScoreLatest.calculatedAt).toLocaleDateString('fr-FR')}</p>
          </div>`;
      }

      // New badges section
      if (stats.newBadges && stats.newBadges.length > 0) {
        const badgeItems = stats.newBadges.map((achievement: any) => {
          const badgeName = achievement.badge?.name ?? 'Badge';
          const badgeDesc = achievement.badge?.description ?? '';
          return `<li style="padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#374151;">&#127942; <strong>${badgeName}</strong>${badgeDesc ? ` — ${badgeDesc}` : ''}</li>`;
        }).join('');

        enrichedSectionsHtml += `
          <div style="background:linear-gradient(135deg,#fefce8,#fef9c3);border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid #fde68a;">
            <p style="margin:0 0 8px;font-size:13px;color:#92400e;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Badges obtenus cette semaine</p>
            <ul style="list-style:none;padding:0;margin:0;">${badgeItems}</ul>
          </div>`;
      }
    }

    variables.enrichedSections = enrichedSectionsHtml;

    return this.sendTemplate(
      toEmail,
      `T-Cardio Pro: Weekly Summary for ${patientName}`,
      'weekly-summary',
      variables,
    );
  }

  /**
   * Send a report email with PDF attachment to a patient or doctor.
   */
  async sendReportEmail(
    toEmail: string,
    recipientName: string,
    patientName: string,
    reportData: {
      periodStart: string;
      periodEnd: string;
      measurementCount: number;
      avgSystolic: number;
      avgDiastolic: number;
      riskLevel: string;
      aiSummary?: string;
    },
    pdfBuffer: Buffer,
    isDoctor: boolean,
  ): Promise<boolean> {
    try {
      // Risk level color mapping
      const riskColors: Record<string, { color: string; colorDark: string; bg: string; border: string }> = {
        FAIBLE:   { color: '#16a34a', colorDark: '#166534', bg: '#f0fdf4,#dcfce7', border: '#bbf7d0' },
        MODERE:   { color: '#ca8a04', colorDark: '#854d0e', bg: '#fefce8,#fef9c3', border: '#fde68a' },
        'MODÉRÉ': { color: '#ca8a04', colorDark: '#854d0e', bg: '#fefce8,#fef9c3', border: '#fde68a' },
        ELEVE:    { color: '#dc2626', colorDark: '#991b1b', bg: '#fef2f2,#fee2e2', border: '#fecaca' },
        'ÉLEVÉ':  { color: '#dc2626', colorDark: '#991b1b', bg: '#fef2f2,#fee2e2', border: '#fecaca' },
        CRITIQUE: { color: '#dc2626', colorDark: '#7f1d1d', bg: '#fef2f2,#fecaca', border: '#f87171' },
      };

      const risk = riskColors[reportData.riskLevel] || riskColors['FAIBLE'];

      // Build AI section HTML (or empty string)
      let aiSection = '';
      if (reportData.aiSummary) {
        aiSection = `
          <div style="background:linear-gradient(135deg,#f5f3ff,#ede9fe);border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #e9d5ff;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="30" valign="top">
                  <span style="font-size:20px;">&#129302;</span>
                </td>
                <td style="padding-left:8px;">
                  <p style="margin:0 0 8px;font-size:13px;color:#7c3aed;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Analyse IA</p>
                  <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;">${reportData.aiSummary}</p>
                </td>
              </tr>
            </table>
          </div>`;
      }

      const introMessage = isDoctor
        ? `Un nouveau rapport médical a été généré pour votre patient <strong>${patientName}</strong>. Voici un résumé des données de la période.`
        : `Votre rapport médical est prêt. Voici un résumé de vos mesures sur la période analysée.`;

      const ctaUrl = isDoctor
        ? 'https://t-cardio.org/doctor/reports'
        : 'https://t-cardio.org/reports';

      const ctaLabel = isDoctor
        ? 'Voir les rapports'
        : 'Voir mes rapports';

      const variables: Record<string, string | number> = {
        recipientName,
        introMessage,
        periodStart: reportData.periodStart,
        periodEnd: reportData.periodEnd,
        avgSystolic: reportData.avgSystolic,
        avgDiastolic: reportData.avgDiastolic,
        measurementCount: reportData.measurementCount,
        riskLevel: reportData.riskLevel,
        riskColor: risk.color,
        riskColorDark: risk.colorDark,
        riskBg: risk.bg,
        riskBorder: risk.border,
        aiSection,
        ctaUrl,
        ctaLabel,
      };

      // Load and render template
      let html = this.templateCache.get('report-generated');

      if (!html) {
        const templatePath = path.join(__dirname, 'templates', 'report-generated.html');
        if (!fs.existsSync(templatePath)) {
          this.logger.error(`Report template not found at ${templatePath}`);
          return false;
        }
        html = fs.readFileSync(templatePath, 'utf-8');
        this.templateCache.set('report-generated', html);
      }

      let rendered = html;
      for (const [key, value] of Object.entries(variables)) {
        const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        rendered = rendered.replace(placeholder, String(value));
      }

      const subject = isDoctor
        ? `T-Cardio Pro: Nouveau rapport pour ${patientName}`
        : `T-Cardio Pro: Votre rapport médical est prêt`;

      return this.sendEmailWithAttachment(toEmail, subject, rendered, [
        {
          filename: 'rapport-tcardio.pdf',
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ]);
    } catch (error) {
      this.logger.error(
        `Failed to send report email to ${toEmail}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}
