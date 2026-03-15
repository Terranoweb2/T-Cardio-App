import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { EmergencyGateway } from '../emergency/emergency.gateway';
import { CreditService } from '../credit/credit.service';
import { EmailService } from '../../core/email/email.service';
import { DoctorWalletService } from '../doctor-wallet/doctor-wallet.service';

// ── Constants ──
const COOLDOWN_AFTER_ACK_MS = 30 * 60 * 1000;        // 30 min cooldown after ACKNOWLEDGED
const COOLDOWN_AFTER_RESOLVED_MS = 10 * 60 * 1000;    // 10 min after RESOLVED (timeout)
const MAX_FREE_PER_DAY = 3;                            // Max 3 free emergencies per day per doctor
const MAX_PAID_PER_DAY = 2;                            // Max 2 paid emergencies per day per doctor
const ABUSE_WINDOW_MS = 24 * 60 * 60 * 1000;          // 24h window for abuse detection
const ABUSE_THRESHOLD = 5;                             // 5+ emergencies in 24h = flagged
const CALLBACK_WINDOW_MS = 60 * 60 * 1000;            // Doctor can callback within 1h of acknowledge

@Injectable()
export class EmergencyCallService {
  private readonly logger = new Logger(EmergencyCallService.name);
  private emergencyTimers: Map<string, NodeJS.Timeout> = new Map();
  private emergencyEmailTimestamps: Map<string, number> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly emergencyGateway: EmergencyGateway,
    private readonly creditService: CreditService,
    private readonly emailService: EmailService,
    private readonly doctorWalletService: DoctorWalletService,
  ) {}

  // ══════════════════════════════════════════════════════════════
  //  AI AUDIT — logs every action for intelligent monitoring
  // ══════════════════════════════════════════════════════════════

  private async audit(data: {
    patientId: string;
    doctorId?: string;
    eventId?: string;
    action: string;
    emergencyType?: string;
    creditDeducted?: number;
    creditRefunded?: number;
    riskScore?: number;
    reason?: string;
    metadata?: any;
  }) {
    try {
      await this.prisma.emergencyAuditLog.create({
        data: {
          patientId: data.patientId,
          doctorId: data.doctorId || null,
          eventId: data.eventId || null,
          action: data.action,
          emergencyType: data.emergencyType || null,
          creditDeducted: data.creditDeducted || 0,
          creditRefunded: data.creditRefunded || 0,
          riskScore: data.riskScore || 0,
          reason: data.reason || null,
          metadata: data.metadata || null,
        },
      });
    } catch (err) {
      this.logger.error(`Audit log failed: ${err}`);
    }
  }

  /**
   * AI risk score calculation based on patient behavior patterns.
   * Score 0-100: 0 = no risk, 100 = definite abuse.
   */
  private async calculateRiskScore(patientId: string, doctorId: string): Promise<{ score: number; reasons: string[] }> {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - ABUSE_WINDOW_MS);
    const weekAgo = new Date(now.getTime() - 7 * ABUSE_WINDOW_MS);

    // Count recent emergencies (24h)
    const recentCount = await this.prisma.emergencyEvent.count({
      where: { patientId, triggerType: 'MANUEL', createdAt: { gte: dayAgo } },
    });

    // Count recent emergencies to this specific doctor (24h)
    const recentToDoctor = await this.prisma.emergencyAuditLog.count({
      where: { patientId, doctorId, action: 'TRIGGER', createdAt: { gte: dayAgo } },
    });

    // Count total paid emergencies this week
    const weeklyPaid = await this.prisma.emergencyAuditLog.count({
      where: { patientId, action: 'TRIGGER', emergencyType: 'paid', createdAt: { gte: weekAgo } },
    });

    // Count refused emergencies (doctor refused = possible nuisance)
    const refusedCount = await this.prisma.emergencyAuditLog.count({
      where: { patientId, action: 'REFUSE', createdAt: { gte: dayAgo } },
    });

    // Count resolved/timeout emergencies (patient triggered but nobody responded)
    const timeoutCount = await this.prisma.emergencyEvent.count({
      where: { patientId, triggerType: 'MANUEL', status: 'RESOLVED', createdAt: { gte: dayAgo } },
    });

    let score = 0;
    const reasons: string[] = [];

    // Frequency-based scoring
    if (recentCount >= ABUSE_THRESHOLD) {
      score += 40;
      reasons.push(`${recentCount} urgences en 24h (seuil: ${ABUSE_THRESHOLD})`);
    } else if (recentCount >= 3) {
      score += 20;
      reasons.push(`${recentCount} urgences en 24h`);
    }

    // Same-doctor targeting
    if (recentToDoctor >= 3) {
      score += 25;
      reasons.push(`${recentToDoctor} urgences vers le meme medecin en 24h`);
    }

    // High paid frequency
    if (weeklyPaid >= 5) {
      score += 20;
      reasons.push(`${weeklyPaid} urgences payantes cette semaine`);
    }

    // Many refusals (doctor actively rejecting)
    if (refusedCount >= 2) {
      score += 15;
      reasons.push(`${refusedCount} refus par le medecin`);
    }

    // Many timeouts (triggering without real need)
    if (timeoutCount >= 2) {
      score += 15;
      reasons.push(`${timeoutCount} urgences expirees sans reponse`);
    }

    return { score: Math.min(score, 100), reasons };
  }

  // ══════════════════════════════════════════════════════════════
  //  ANTI-RELANCE — cooldown system
  // ══════════════════════════════════════════════════════════════

  /**
   * Check if a patient can trigger a new emergency to a specific doctor.
   * Returns { allowed: boolean, reason?: string, cooldownEndsAt?: Date }
   */
  private async checkCooldown(patientId: string, doctorId: string): Promise<{ allowed: boolean; reason?: string; cooldownEndsAt?: Date }> {
    const now = new Date();

    // 1. Check for ACTIVE emergency (already ongoing)
    const activeEmergency = await this.prisma.emergencyEvent.findFirst({
      where: {
        patientId,
        triggerType: 'MANUEL',
        status: 'ACTIVE',
      },
    });
    if (activeEmergency) {
      return { allowed: false, reason: 'Un appel d\'urgence est deja en cours.' };
    }

    // 2. Check cooldown after ACKNOWLEDGED (30 min)
    const lastAcknowledged = await this.prisma.emergencyEvent.findFirst({
      where: {
        patientId,
        triggerType: 'MANUEL',
        status: 'ACKNOWLEDGED',
        acknowledgedAt: { gte: new Date(now.getTime() - COOLDOWN_AFTER_ACK_MS) },
      },
      orderBy: { acknowledgedAt: 'desc' },
    });
    if (lastAcknowledged?.acknowledgedAt) {
      const cooldownEnd = new Date(lastAcknowledged.acknowledgedAt.getTime() + COOLDOWN_AFTER_ACK_MS);
      const minutesLeft = Math.ceil((cooldownEnd.getTime() - now.getTime()) / 60_000);
      return {
        allowed: false,
        reason: `Votre urgence precedente a ete prise en charge. Nouvel appel possible dans ${minutesLeft} min.`,
        cooldownEndsAt: cooldownEnd,
      };
    }

    // 3. Check cooldown after RESOLVED/timeout (10 min)
    const lastResolved = await this.prisma.emergencyEvent.findFirst({
      where: {
        patientId,
        triggerType: 'MANUEL',
        status: 'RESOLVED',
        createdAt: { gte: new Date(now.getTime() - COOLDOWN_AFTER_RESOLVED_MS) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (lastResolved) {
      const cooldownEnd = new Date(lastResolved.createdAt.getTime() + COOLDOWN_AFTER_RESOLVED_MS);
      const minutesLeft = Math.ceil((cooldownEnd.getTime() - now.getTime()) / 60_000);
      return {
        allowed: false,
        reason: `Veuillez patienter ${minutesLeft} min avant de relancer un appel.`,
        cooldownEndsAt: cooldownEnd,
      };
    }

    return { allowed: true };
  }

  /**
   * Check daily limits for a patient-doctor pair.
   */
  private async checkDailyLimits(patientId: string, doctorId: string, emergencyType: 'free' | 'paid'): Promise<{ allowed: boolean; reason?: string }> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayCount = await this.prisma.emergencyAuditLog.count({
      where: {
        patientId,
        doctorId,
        action: 'TRIGGER',
        emergencyType,
        createdAt: { gte: todayStart },
      },
    });

    const limit = emergencyType === 'paid' ? MAX_PAID_PER_DAY : MAX_FREE_PER_DAY;
    if (todayCount >= limit) {
      return {
        allowed: false,
        reason: `Limite quotidienne atteinte: ${limit} appels ${emergencyType === 'paid' ? 'payants' : 'gratuits'} par jour maximum.`,
      };
    }

    return { allowed: true };
  }

  // ══════════════════════════════════════════════════════════════
  //  TRIGGER — protected emergency call
  // ══════════════════════════════════════════════════════════════

  async triggerEmergencyCall(patientUserId: string, doctorId: string, emergencyType: 'free' | 'paid' = 'free') {
    // Find patient
    const patient = await this.prisma.patient.findUnique({ where: { userId: patientUserId } });
    if (!patient) throw new NotFoundException('Profil patient introuvable');

    // Find doctor + verify link
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!doctor) throw new NotFoundException('Medecin introuvable');

    const link = await this.prisma.patientDoctorLink.findFirst({
      where: { patientId: patient.id, doctorId: doctor.id, status: 'ACTIVE' },
    });
    if (!link) throw new BadRequestException('Vous n\'etes pas associe a ce medecin');

    // ── ANTI-RELANCE: cooldown check ──
    const cooldown = await this.checkCooldown(patient.id, doctor.id);
    if (!cooldown.allowed) {
      await this.audit({
        patientId: patient.id, doctorId: doctor.id,
        action: 'BLOCKED', emergencyType, reason: cooldown.reason,
      });
      throw new BadRequestException(cooldown.reason);
    }

    // ── DAILY LIMITS ──
    const limits = await this.checkDailyLimits(patient.id, doctor.id, emergencyType);
    if (!limits.allowed) {
      await this.audit({
        patientId: patient.id, doctorId: doctor.id,
        action: 'BLOCKED', emergencyType, reason: limits.reason,
      });
      throw new BadRequestException(limits.reason);
    }

    // ── AI RISK SCORE ──
    const risk = await this.calculateRiskScore(patient.id, doctor.id);
    if (risk.score >= 80) {
      const reason = `Comportement suspect detecte (score: ${risk.score}/100). ${risk.reasons.join('. ')}. Contactez le 15 pour une vraie urgence.`;
      await this.audit({
        patientId: patient.id, doctorId: doctor.id,
        action: 'ABUSE_DETECTED', emergencyType, riskScore: risk.score,
        reason, metadata: { reasons: risk.reasons },
      });
      throw new ForbiddenException(reason);
    }

    const patientName = `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Patient';
    const doctorUserId = doctor.userId;
    const doctorEmail = doctor.user?.email;

    // ── PAID: validate prerequisites + single deduction ──
    let creditDeducted = 0;
    if (emergencyType === 'paid') {
      const completedCount = await this.prisma.teleconsultation.count({
        where: { patientId: patient.id, status: 'ENDED' },
      });
      if (completedCount < 1) {
        throw new BadRequestException(
          'Vous devez avoir termine au moins une teleconsultation avant un appel d\'urgence payant.',
        );
      }

      try {
        await this.creditService.deductForEmergency(patient.id, `emergency_${Date.now()}`);
        creditDeducted = 1000;
        this.logger.log(`Emergency credits deducted: patient=${patient.id}`);
      } catch (err) {
        throw new BadRequestException(`Credits insuffisants: ${err.message}`);
      }
    }

    // ── CREATE EVENT ──
    const event = await this.prisma.emergencyEvent.create({
      data: {
        patientId: patient.id,
        triggerType: 'MANUEL',
        triggerValue: {
          reason: 'emergency_call',
          emergencyType,
          doctorId: doctor.id,
          callbackUsed: false,
        },
        status: 'ACTIVE',
        patientNotifiedAt: new Date(),
        doctorNotifiedAt: new Date(),
      },
    });

    // ── AUDIT LOG ──
    await this.audit({
      patientId: patient.id, doctorId: doctor.id, eventId: event.id,
      action: 'TRIGGER', emergencyType, creditDeducted, riskScore: risk.score,
      metadata: { riskReasons: risk.reasons },
    });

    // ── CREATE ALERT ──
    await this.prisma.alert.create({
      data: {
        patientId: patient.id,
        doctorId: doctor.id,
        type: 'EMERGENCY',
        title: 'URGENCE - Appel patient',
        message: `${patientName} demande un appel d'urgence${emergencyType === 'paid' ? ' payant' : ''}. Reagissez immediatement.`,
        severity: 'CRITIQUE',
        metadata: { emergencyType, eventId: event.id },
      },
    });

    // ── NOTIFY DOCTOR ──
    const emergencyPayload = {
      id: event.id,
      type: 'emergency_call',
      emergencyType,
      patientId: patient.id,
      patientName,
      doctorId: doctor.id,
      message: `URGENCE: ${patientName} demande un appel d'urgence. Reagissez immediatement.`,
    };
    this.emergencyGateway.notifyDoctor(doctorUserId, emergencyPayload);

    if (emergencyType === 'paid' && doctorEmail) {
      this.emailService.sendEmergencyCallAlert(
        doctorEmail, patientName, emergencyType, event.id, 1,
      ).catch((err) => this.logger.warn(`Emergency email failed: ${err}`));
      this.emergencyEmailTimestamps.set(`email_${event.id}`, Date.now());
    }

    // ── REPEATED NOTIFICATIONS ──
    let repeatCount = 0;
    const intervalMs = emergencyType === 'paid' ? 20_000 : 30_000;
    const maxRepeats = emergencyType === 'paid' ? 15 : 10;
    const timerKey = `emergency_${event.id}`;

    const interval = setInterval(async () => {
      repeatCount++;
      try {
        const currentEvent = await this.prisma.emergencyEvent.findUnique({ where: { id: event.id } });
        if (!currentEvent || currentEvent.status !== 'ACTIVE' || repeatCount >= maxRepeats) {
          clearInterval(interval);
          this.emergencyTimers.delete(timerKey);
          this.emergencyEmailTimestamps.delete(`email_${event.id}`);

          if (currentEvent?.status === 'ACTIVE' && repeatCount >= maxRepeats) {
            await this.prisma.emergencyEvent.update({
              where: { id: event.id },
              data: { status: 'RESOLVED', resolvedAt: new Date() },
            });
            if (patient.userId) {
              this.emergencyGateway.notifyPatient(
                patient.userId,
                'Votre medecin n\'a pas pu repondre. Veuillez reessayer plus tard ou contacter le 15.',
              );
            }
          }
          return;
        }

        this.emergencyGateway.notifyDoctor(doctorUserId, {
          ...emergencyPayload,
          repeatNumber: repeatCount,
          message: `URGENCE REPETEE (${repeatCount}): ${patientName} attend votre reponse.`,
        });

        if (emergencyType === 'paid' && doctorEmail) {
          const emailKey = `email_${event.id}`;
          const lastEmailTime = this.emergencyEmailTimestamps.get(emailKey) || 0;
          if (Date.now() - lastEmailTime >= 60_000) {
            this.emailService.sendEmergencyCallAlert(
              doctorEmail, patientName, emergencyType, event.id, repeatCount + 1,
            ).catch((err) => this.logger.warn(`Emergency email repeat failed: ${err}`));
            this.emergencyEmailTimestamps.set(emailKey, Date.now());
          }
        }
      } catch (err) {
        this.logger.error(`Emergency repeat error: ${err}`);
        if (repeatCount >= maxRepeats) {
          clearInterval(interval);
          this.emergencyTimers.delete(timerKey);
        }
      }
    }, intervalMs);

    this.emergencyTimers.set(timerKey, interval);
    this.logger.warn(`EMERGENCY triggered: ${event.id} by ${patientName} (type=${emergencyType}, risk=${risk.score})`);

    return { eventId: event.id, status: 'emergency_triggered', doctorId: doctor.id, riskScore: risk.score };
  }

  // ══════════════════════════════════════════════════════════════
  //  ACKNOWLEDGE — doctor accepts
  // ══════════════════════════════════════════════════════════════

  async acknowledgeEmergencyCall(eventId: string, doctorUserId: string) {
    const timerKey = `emergency_${eventId}`;
    const timer = this.emergencyTimers.get(timerKey);
    if (timer) {
      clearInterval(timer);
      this.emergencyTimers.delete(timerKey);
    }
    this.emergencyEmailTimestamps.delete(`email_${eventId}`);

    const event = await this.prisma.emergencyEvent.update({
      where: { id: eventId },
      data: { status: 'ACKNOWLEDGED', acknowledgedBy: doctorUserId, acknowledgedAt: new Date() },
    });

    const patient = await this.prisma.patient.findUnique({ where: { id: event.patientId } });
    if (patient?.userId) {
      this.emergencyGateway.notifyPatient(
        patient.userId,
        'Votre medecin a accepte votre appel d\'urgence et arrive !',
      );
    }

    this.emergencyGateway.server
      .to(`doctor_${doctorUserId}`)
      .emit('emergency_resolved', { eventId, status: 'accepted' });

    // Credit doctor wallet for paid emergency
    const emergencyData = (event.triggerValue as any) || {};
    try {
      if (emergencyData.emergencyType === 'paid') {
        const doctor = await this.prisma.doctor.findUnique({ where: { userId: doctorUserId } });
        if (doctor) {
          await this.doctorWalletService.creditForEmergency(doctor.id, eventId);
          this.logger.log(`Doctor wallet credited for paid emergency ${eventId}`);
        }
      }
    } catch (err) {
      this.logger.warn(`Doctor wallet credit failed: ${err.message}`);
    }

    // Audit
    await this.audit({
      patientId: event.patientId, doctorId: emergencyData.doctorId, eventId,
      action: 'ACKNOWLEDGE', emergencyType: emergencyData.emergencyType,
    });

    this.logger.log(`Emergency ${eventId} ACCEPTED by ${doctorUserId}`);
    return event;
  }

  // ══════════════════════════════════════════════════════════════
  //  REFUSE — doctor temporarily dismisses
  // ══════════════════════════════════════════════════════════════

  async refuseEmergencyCall(eventId: string, doctorUserId: string) {
    const event = await this.prisma.emergencyEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Emergency event not found');
    if (event.status !== 'ACTIVE') {
      return { eventId, status: event.status, message: 'Emergency is no longer active' };
    }

    const metadata = (event.triggerValue as any) || {};
    const refusals = (metadata.refusals || 0) + 1;

    await this.prisma.emergencyEvent.update({
      where: { id: eventId },
      data: { triggerValue: { ...metadata, refusals, lastRefusedAt: new Date().toISOString() } },
    });

    const patient = await this.prisma.patient.findUnique({ where: { id: event.patientId } });
    if (patient?.userId) {
      this.emergencyGateway.notifyPatient(
        patient.userId,
        'Votre medecin est occupe. Nouvelle tentative de notification en cours...',
      );
    }

    this.emergencyGateway.server
      .to(`doctor_${doctorUserId}`)
      .emit('emergency_resolved', { eventId, status: 'refused' });

    await this.audit({
      patientId: event.patientId, doctorId: metadata.doctorId, eventId,
      action: 'REFUSE', emergencyType: metadata.emergencyType,
    });

    return { eventId, status: 'refused', refusals };
  }

  // ══════════════════════════════════════════════════════════════
  //  CALLBACK — doctor calls back patient (paid emergency only, 1 time)
  // ══════════════════════════════════════════════════════════════

  async doctorCallback(eventId: string, doctorUserId: string) {
    const event = await this.prisma.emergencyEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Urgence introuvable');
    if (event.status !== 'ACKNOWLEDGED') {
      throw new BadRequestException('L\'urgence doit etre acceptee avant de rappeler le patient.');
    }

    const metadata = (event.triggerValue as any) || {};

    // Only paid emergencies
    if (metadata.emergencyType !== 'paid') {
      throw new BadRequestException('Le rappel n\'est disponible que pour les urgences payantes.');
    }

    // One-time callback protection
    if (metadata.callbackUsed) {
      throw new BadRequestException('Vous avez deja rappele ce patient pour cette urgence.');
    }

    // Time window check (1h after acknowledge)
    if (event.acknowledgedAt) {
      const elapsed = Date.now() - event.acknowledgedAt.getTime();
      if (elapsed > CALLBACK_WINDOW_MS) {
        throw new BadRequestException('Le delai de rappel est depasse (1h maximum apres acceptation).');
      }
    }

    // Verify this doctor acknowledged it
    if (event.acknowledgedBy !== doctorUserId) {
      throw new ForbiddenException('Seul le medecin ayant accepte peut rappeler.');
    }

    const doctor = await this.prisma.doctor.findUnique({
      where: { userId: doctorUserId },
      include: { user: { select: { email: true } } },
    });
    if (!doctor) throw new NotFoundException('Profil medecin introuvable');

    const patient = await this.prisma.patient.findUnique({
      where: { id: event.patientId },
      include: { user: { select: { id: true } } },
    });
    if (!patient) throw new NotFoundException('Patient introuvable');

    // Create a teleconsultation for the callback (FREE — no extra credit deduction)
    const teleconsultation = await this.prisma.teleconsultation.create({
      data: {
        patientId: patient.id,
        doctorId: doctor.id,
        status: 'ACTIVE',
        reason: `Rappel urgence payante #${eventId.slice(0, 8)}`,
        scheduledAt: new Date(),
        startedAt: new Date(),
        durationMinutes: 15,
      },
    });

    // Mark callback as used (one-time protection)
    await this.prisma.emergencyEvent.update({
      where: { id: eventId },
      data: { triggerValue: { ...metadata, callbackUsed: true, callbackTeleconsultationId: teleconsultation.id } },
    });

    // Notify patient of incoming callback
    if (patient.user?.id) {
      this.emergencyGateway.notifyPatient(
        patient.user.id,
        `Dr. ${doctor.firstName || ''} ${doctor.lastName || ''} vous rappelle suite a votre urgence.`,
      );

      // Also send incoming call notification
      this.emergencyGateway.notifyIncomingCall(patient.user.id, 'PATIENT', {
        teleconsultationId: teleconsultation.id,
        callerName: `Dr. ${doctor.firstName || ''} ${doctor.lastName || ''}`.trim(),
        callerRole: 'MEDECIN',
        callerId: doctorUserId,
      });
    }

    // Audit
    await this.audit({
      patientId: patient.id, doctorId: doctor.id, eventId,
      action: 'CALLBACK', emergencyType: 'paid',
      metadata: { teleconsultationId: teleconsultation.id },
    });

    this.logger.log(`Doctor ${doctorUserId} callback for emergency ${eventId} -> teleconsultation ${teleconsultation.id}`);

    return {
      teleconsultationId: teleconsultation.id,
      status: 'callback_initiated',
      message: 'Teleconsultation creee. Le patient est notifie.',
    };
  }

  // ══════════════════════════════════════════════════════════════
  //  COOLDOWN STATUS — for frontend
  // ══════════════════════════════════════════════════════════════

  async getCooldownStatus(patientUserId: string, doctorId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { userId: patientUserId } });
    if (!patient) throw new NotFoundException('Profil patient introuvable');

    const cooldown = await this.checkCooldown(patient.id, doctorId);
    return cooldown;
  }

  // ══════════════════════════════════════════════════════════════
  //  HISTORY — with enriched data
  // ══════════════════════════════════════════════════════════════

  async getPatientEmergencies(patientUserId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { userId: patientUserId } });
    if (!patient) throw new NotFoundException('Profil patient introuvable');

    return this.prisma.emergencyEvent.findMany({
      where: { patientId: patient.id, triggerType: 'MANUEL' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getDoctorEmergencies(doctorUserId: string) {
    const doctor = await this.prisma.doctor.findUnique({ where: { userId: doctorUserId } });
    if (!doctor) throw new NotFoundException('Profil medecin introuvable');

    const linkedPatientIds = await this.prisma.patientDoctorLink.findMany({
      where: { doctorId: doctor.id, status: 'ACTIVE' },
      select: { patientId: true },
    });
    const patientIds = linkedPatientIds.map(l => l.patientId);

    return this.prisma.emergencyEvent.findMany({
      where: {
        patientId: { in: patientIds },
        triggerType: 'MANUEL',
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ══════════════════════════════════════════════════════════════
  //  ADMIN — AI audit dashboard data
  // ══════════════════════════════════════════════════════════════

  async getAuditLogs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.emergencyAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          patient: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.emergencyAuditLog.count(),
    ]);
    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getAbuseFlags() {
    const dayAgo = new Date(Date.now() - ABUSE_WINDOW_MS);
    return this.prisma.emergencyAuditLog.findMany({
      where: {
        action: { in: ['ABUSE_DETECTED', 'BLOCKED'] },
        createdAt: { gte: dayAgo },
      },
      include: {
        patient: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
