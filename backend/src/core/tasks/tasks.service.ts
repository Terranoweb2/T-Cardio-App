import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { PushService } from '../push/push.service';
import { SubscriptionService } from '../../modules/subscription/subscription.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly pushService: PushService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  // ─── 1. Every hour — Configurable measurement reminders ───

  @Cron('0 * * * *')
  async handleMeasurementReminder(): Promise<void> {
    const start = Date.now();
    const now = new Date();
    const currentHour = now.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hour12: false }).slice(0, 5);
    this.logger.log(`Starting measurement reminder job (${currentHour})`);

    try {
      // 1. Handle patients WITH configured reminders
      const reminders = await this.prisma.measurementReminder.findMany({
        where: { enabled: true },
        include: {
          patient: {
            include: {
              user: { select: { email: true, status: true } },
              measurements: { orderBy: { measuredAt: 'desc' }, take: 1, select: { measuredAt: true } },
            },
          },
        },
      });

      let sentCount = 0;

      for (const reminder of reminders) {
        if (reminder.patient.user.status !== 'ACTIVE') continue;

        // Check if current hour matches any of the preferred times
        const matchesTime = reminder.preferredTimes.some((t) => t === currentHour);
        if (!matchesTime) continue;

        // Check if already sent this hour
        if (reminder.lastSentAt) {
          const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
          if (reminder.lastSentAt > hourAgo) continue;
        }

        const email = reminder.patient.user.email;
        const name = reminder.patient.firstName ?? 'Patient';

        try {
          // Send via configured channel
          if (reminder.channel === 'EMAIL' || reminder.channel === 'BOTH') {
            if (email) {
              await this.emailService.sendMeasurementReminder(email, name);
            }
          }
          if (reminder.channel === 'IN_APP' || reminder.channel === 'BOTH') {
            await this.prisma.alert.create({
              data: {
                patientId: reminder.patientId,
                type: 'MEASUREMENT',
                title: 'Rappel de mesure',
                message: 'Il est temps de mesurer votre tension arterielle.',
                severity: 'FAIBLE',
              },
            });
            // Push notification for when the app is closed
            this.pushService.sendReminderPush(
              reminder.patient.userId,
              'Il est temps de mesurer votre tension arterielle.',
            ).catch(() => {});
          }

          await this.prisma.measurementReminder.update({
            where: { id: reminder.id },
            data: { lastSentAt: new Date() },
          });
          sentCount++;
        } catch (err) {
          this.logger.warn(`Failed to send configurable reminder to ${reminder.patientId}: ${err.message}`);
        }
      }

      // 2. Fallback: patients WITHOUT configured reminders (only at 8am)
      if (currentHour === '08:00') {
        const configuredPatientIds = reminders.map((r) => r.patientId);
        const threshold = new Date(Date.now() - 48 * 60 * 60 * 1000);

        const patients = await this.prisma.patient.findMany({
          where: {
            user: { status: 'ACTIVE' },
            id: { notIn: configuredPatientIds },
          },
          include: {
            user: { select: { email: true } },
            measurements: { orderBy: { measuredAt: 'desc' }, take: 1, select: { measuredAt: true } },
          },
        });

        const patientsToRemind = patients.filter((p) => {
          if (p.measurements.length === 0) return true;
          return p.measurements[0].measuredAt < threshold;
        });

        for (const patient of patientsToRemind) {
          const email = patient.user.email;
          try {
            if (email) {
              await this.emailService.sendMeasurementReminder(email, patient.firstName ?? 'Patient');
            }
            // Push notification for when the app is closed
            this.pushService.sendReminderPush(
              patient.userId,
              'Il est temps de mesurer votre tension arterielle.',
            ).catch(() => {});
            sentCount++;
          } catch (err) {
            this.logger.warn(`Failed to send fallback reminder to ${patient.id}: ${err.message}`);
          }
        }
      }

      this.logger.log(`Measurement reminder job completed: ${sentCount} reminders sent (${Date.now() - start}ms)`);
    } catch (error) {
      this.logger.error(`Measurement reminder job failed: ${error.message}`, error.stack);
    }
  }

  // ─── 1b. Every 30 min — Medication reminder push ───

  @Cron('0 */30 * * * *')
  async handleMedicationReminder(): Promise<void> {
    const start = Date.now();
    const now = new Date();
    const currentHour = now.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hour12: false }).slice(0, 5);
    this.logger.log(`Starting medication reminder job (${currentHour})`);

    try {
      // Find all active medications whose reminderTimes match the current time (HH:MM)
      const activeMedications = await this.prisma.medication.findMany({
        where: {
          isActive: true,
          startDate: { lte: now },
          OR: [{ endDate: null }, { endDate: { gte: now } }],
        },
        include: {
          patient: {
            include: {
              user: { select: { id: true, status: true } },
            },
          },
        },
      });

      let sentCount = 0;

      for (const med of activeMedications) {
        if (med.patient.user.status !== 'ACTIVE') continue;

        // Check if current time matches one of the medication's reminderTimes
        const matchesTime = (med.reminderTimes || []).some((t) => t === currentHour);
        if (!matchesTime) continue;

        // Check if a log already exists for this medication at this time today
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        const [hours, minutes] = currentHour.split(':').map(Number);
        const scheduledAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);

        const existingLog = await this.prisma.medicationLog.findFirst({
          where: {
            medicationId: med.id,
            scheduledAt: {
              gte: new Date(scheduledAt.getTime() - 60 * 1000), // 1 min tolerance
              lte: new Date(scheduledAt.getTime() + 60 * 1000),
            },
          },
        });

        // Skip if already logged (TAKEN or SKIPPED)
        if (existingLog) continue;

        try {
          // Create in-app alert
          await this.prisma.alert.create({
            data: {
              patientId: med.patientId,
              type: 'MEASUREMENT',
              title: `Rappel medicament: ${med.name}`,
              message: `Il est temps de prendre ${med.name} (${med.dosage || ''})`.trim(),
              severity: 'FAIBLE',
            },
          });

          // Push notification
          this.pushService
            .sendPush(med.patient.userId, {
              title: `💊 Rappel: ${med.name}`,
              body: `Il est temps de prendre ${med.name}${med.dosage ? ' — ' + med.dosage : ''}`,
              icon: '/logo-T-Cardio.png',
              tag: `med-reminder-${med.id}-${currentHour}`,
              data: { type: 'medication_reminder', medicationId: med.id },
            })
            .catch(() => {});

          sentCount++;
        } catch (err) {
          this.logger.warn(`Failed to send medication reminder for ${med.id}: ${err.message}`);
        }
      }

      this.logger.log(`Medication reminder job completed: ${sentCount} reminders sent (${Date.now() - start}ms)`);
    } catch (error) {
      this.logger.error(`Medication reminder job failed: ${error.message}`, error.stack);
    }
  }

  // ─── 2. Monday 9am — Weekly patient email summary ───

  @Cron('0 9 * * 1')
  async handleWeeklySummary(): Promise<void> {
    const start = Date.now();
    this.logger.log('Starting weekly summary job');

    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const patients = await this.prisma.patient.findMany({
        where: {
          user: { status: 'ACTIVE' },
        },
        include: {
          user: { select: { email: true } },
        },
      });

      let sentCount = 0;

      for (const patient of patients) {
        const email = patient.user.email;
        if (!email) continue;

        try {
          // Get last 7 days of measurements for stats
          const measurements = await this.prisma.bpMeasurement.findMany({
            where: {
              patientId: patient.id,
              measuredAt: { gte: sevenDaysAgo },
            },
            orderBy: { measuredAt: 'asc' },
          });

          const stats: Record<string, any> = {
            totalMeasurements: measurements.length,
            avgSystolic: measurements.length
              ? Math.round(
                  measurements.reduce((sum, m) => sum + m.systolic, 0) /
                    measurements.length,
                )
              : null,
            avgDiastolic: measurements.length
              ? Math.round(
                  measurements.reduce((sum, m) => sum + m.diastolic, 0) /
                    measurements.length,
                )
              : null,
            avgPulse: measurements.filter((m) => m.pulse != null).length
              ? Math.round(
                  measurements
                    .filter((m) => m.pulse != null)
                    .reduce((sum, m) => sum + m.pulse!, 0) /
                    measurements.filter((m) => m.pulse != null).length,
                )
              : null,
            minSystolic: measurements.length
              ? Math.min(...measurements.map((m) => m.systolic))
              : null,
            maxSystolic: measurements.length
              ? Math.max(...measurements.map((m) => m.systolic))
              : null,
          };

          // ── Enriched data: Medication adherence ──
          try {
            const medicationLogs = await this.prisma.medicationLog.findMany({
              where: {
                medication: { patientId: patient.id },
                takenAt: { gte: sevenDaysAgo },
                status: { in: ['TAKEN', 'SKIPPED', 'MISSED'] },
              },
            });
            if (medicationLogs.length > 0) {
              const takenCount = medicationLogs.filter((l) => l.status === 'TAKEN').length;
              stats.medicationAdherence = Math.round((takenCount / medicationLogs.length) * 100);
            } else {
              stats.medicationAdherence = null;
            }
          } catch {
            stats.medicationAdherence = null;
          }

          // ── Enriched data: Upcoming appointments ──
          try {
            const now = new Date();
            stats.upcomingAppointments = await this.prisma.appointment.findMany({
              where: {
                patientId: patient.id,
                status: { in: ['APPT_PENDING', 'APPT_CONFIRMED'] as any },
                scheduledAt: { gt: now },
              },
              orderBy: { scheduledAt: 'asc' },
              take: 3,
            });
          } catch {
            stats.upcomingAppointments = [];
          }

          // ── Enriched data: Risk score evolution ──
          try {
            const riskScores = await this.prisma.cardioRiskScore.findMany({
              where: { patientId: patient.id },
              orderBy: { calculatedAt: 'desc' },
              take: 2,
            });
            stats.riskScoreLatest = riskScores[0] ?? null;
            stats.riskScorePrevious = riskScores[1] ?? null;
          } catch {
            stats.riskScoreLatest = null;
            stats.riskScorePrevious = null;
          }

          // ── Enriched data: Badges earned this week ──
          try {
            stats.newBadges = await this.prisma.achievement.findMany({
              where: {
                patientId: patient.id,
                unlockedAt: { gte: sevenDaysAgo },
              },
              include: { badge: true },
            });
          } catch {
            stats.newBadges = [];
          }

          await this.emailService.sendWeeklySummary(
            email,
            patient.firstName ?? 'Patient',
            stats,
          );
          sentCount++;
        } catch (err) {
          this.logger.warn(
            `Failed to send weekly summary to patient ${patient.id}: ${err.message}`,
          );
        }
      }

      this.logger.log(
        `Weekly summary job completed: ${sentCount}/${patients.length} summaries sent (${Date.now() - start}ms)`,
      );
    } catch (error) {
      this.logger.error(
        `Weekly summary job failed: ${error.message}`,
        error.stack,
      );
    }
  }

  // ─── 3. Monday 2am — Auto-generate weekly report for active patients ───

  @Cron('0 2 * * 1')
  async handleAutoReportGeneration(): Promise<void> {
    const start = Date.now();
    this.logger.log('Starting auto report generation job');

    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const now = new Date();

      const eligiblePatients: string[] = [];

      // Find active patients and check measurement count for the period
      const patientsActive = await this.prisma.patient.findMany({
        where: {
          user: { status: 'ACTIVE' },
        },
        select: { id: true },
      });

      for (const patient of patientsActive) {
        const count = await this.prisma.bpMeasurement.count({
          where: {
            patientId: patient.id,
            measuredAt: { gte: sevenDaysAgo },
          },
        });

        if (count >= 5) {
          eligiblePatients.push(patient.id);
        }
      }

      let generatedCount = 0;

      for (const patientId of eligiblePatients) {
        try {
          // Create a report record directly via Prisma
          // (avoids importing ReportsService and its heavy dependencies)
          const periodStart = sevenDaysAgo;
          const periodEnd = now;

          await this.prisma.report.create({
            data: {
              patientId,
              periodStart,
              periodEnd,
              reportType: 'HEBDOMADAIRE',
              title: `Rapport hebdomadaire - ${periodStart.toISOString().split('T')[0]} au ${periodEnd.toISOString().split('T')[0]}`,
              filePath: '', // PDF will be generated asynchronously or by a separate worker
              summary: 'Auto-generated weekly report — pending PDF generation.',
            },
          });

          generatedCount++;
        } catch (err) {
          this.logger.warn(
            `Failed to create report for patient ${patientId}: ${err.message}`,
          );
        }
      }

      this.logger.log(
        `Auto report generation job completed: ${generatedCount}/${eligiblePatients.length} reports created (${Date.now() - start}ms)`,
      );
    } catch (error) {
      this.logger.error(
        `Auto report generation job failed: ${error.message}`,
        error.stack,
      );
    }
  }

  // ─── 4. Daily 3am — Auto-trigger AI analysis if >= 5 new measurements unanalyzed ───

  @Cron('0 3 * * *')
  async handleAutoAiAnalysis(): Promise<void> {
    const start = Date.now();
    this.logger.log('Starting auto AI analysis job');

    try {
      // Find active patients
      const patients = await this.prisma.patient.findMany({
        where: {
          user: { status: 'ACTIVE' },
        },
        select: { id: true },
      });

      let triggeredCount = 0;

      for (const patient of patients) {
        try {
          // Get the latest AI analysis for this patient
          const lastAnalysis = await this.prisma.aiAnalysis.findFirst({
            where: { patientId: patient.id },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          });

          // Count measurements newer than the last analysis
          const sinceDate = lastAnalysis?.createdAt ?? new Date(0);

          const newMeasurementsCount = await this.prisma.bpMeasurement.count({
            where: {
              patientId: patient.id,
              measuredAt: { gt: sinceDate },
            },
          });

          if (newMeasurementsCount >= 5) {
            // Get the new measurements for the analysis record
            const newMeasurements = await this.prisma.bpMeasurement.findMany({
              where: {
                patientId: patient.id,
                measuredAt: { gt: sinceDate },
              },
              orderBy: { measuredAt: 'asc' },
            });

            // Create a placeholder AI analysis record via Prisma
            // (avoids importing AiEngineService and its heavy dependencies)
            await this.prisma.aiAnalysis.create({
              data: {
                patientId: patient.id,
                patientIdHash: Buffer.from(patient.id).toString('base64'),
                measurementIds: newMeasurements.map((m) => m.id),
                inputData: {},
                inputMeasurementsCount: newMeasurements.length,
                inputPeriodDays: Math.ceil(
                  (Date.now() - sinceDate.getTime()) / (1000 * 60 * 60 * 24),
                ),
                modelName: 'scheduled-placeholder',
                processingTimeMs: 0,
                patientSummary:
                  'Analyse programmee — en attente de traitement par le moteur IA.',
                doctorSummary:
                  'Analyse programmee — en attente de traitement par le moteur IA.',
              },
            });

            triggeredCount++;
            this.logger.debug(
              `Queued AI analysis for patient ${patient.id} (${newMeasurementsCount} new measurements)`,
            );
          }
        } catch (err) {
          this.logger.warn(
            `Failed to process AI analysis for patient ${patient.id}: ${err.message}`,
          );
        }
      }

      this.logger.log(
        `Auto AI analysis job completed: ${triggeredCount} analyses triggered for ${patients.length} patients (${Date.now() - start}ms)`,
      );
    } catch (error) {
      this.logger.error(
        `Auto AI analysis job failed: ${error.message}`,
        error.stack,
      );
    }
  }

  // ─── 5. Daily 4am — Clean expired refresh tokens ───

  @Cron('0 4 * * *')
  async handleTokenCleanup(): Promise<void> {
    const start = Date.now();
    this.logger.log('Starting token cleanup job');

    try {
      const now = new Date();

      const result = await this.prisma.refreshToken.deleteMany({
        where: {
          expiresAt: { lt: now },
        },
      });

      this.logger.log(
        `Token cleanup job completed: ${result.count} expired tokens deleted (${Date.now() - start}ms)`,
      );
    } catch (error) {
      this.logger.error(
        `Token cleanup job failed: ${error.message}`,
        error.stack,
      );
    }
  }

  // ─── 6. Daily 1am — Expire overdue subscriptions ───

  @Cron('0 1 * * *')
  async handleSubscriptionExpiration(): Promise<void> {
    const start = Date.now();
    this.logger.log('Starting subscription expiration job');

    try {
      const expiredCount =
        await this.subscriptionService.expireOverdueSubscriptions();

      this.logger.log(
        `Subscription expiration job completed: ${expiredCount} subscription(s) expired (${Date.now() - start}ms)`,
      );
    } catch (error) {
      this.logger.error(
        `Subscription expiration job failed: ${error.message}`,
        error.stack,
      );
    }
  }

  // ─── 7. Daily 9am — Subscription renewal reminder (7 days before expiry) ───

  @Cron('0 9 * * *')
  async handleSubscriptionRenewalReminder(): Promise<void> {
    const start = Date.now();
    this.logger.log('Starting subscription renewal reminder job');

    try {
      const expiring =
        await this.subscriptionService.findExpiringSubscriptions(7);

      let sentCount = 0;

      for (const sub of expiring) {
        const email = sub.patient?.user?.email;
        if (!email) continue;

        try {
          const daysLeft = Math.ceil(
            (sub.endDate!.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
          );
          const patientName = sub.patient?.firstName || 'Patient';

          await this.emailService.sendEmail(
            email,
            'Renouvellement abonnement T-Cardio Pro',
            `<h2>Rappel de renouvellement</h2>
            <p>Bonjour ${patientName},</p>
            <p>Votre abonnement T-Cardio Pro expire dans <strong>${daysLeft} jour(s)</strong>.</p>
            <p>Renouvelez-le pour continuer a beneficier de nos services de teleconsultation et suivi cardiologique.</p>
            <p>Cordialement,<br>L'equipe T-Cardio Pro</p>`,
          );
          sentCount++;
        } catch (err) {
          this.logger.warn(
            `Failed to send renewal reminder to ${email}: ${err.message}`,
          );
        }
      }

      this.logger.log(
        `Subscription renewal reminder job completed: ${sentCount}/${expiring.length} reminders sent (${Date.now() - start}ms)`,
      );
    } catch (error) {
      this.logger.error(
        `Subscription renewal reminder job failed: ${error.message}`,
        error.stack,
      );
    }
  }

  // ─── 8. Monthly 1st at midnight — Log monthly stats for admin ───

  @Cron('0 0 1 * *')
  async handleMonthlyStats(): Promise<void> {
    const start = Date.now();
    this.logger.log('Starting monthly stats job');

    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

      const [totalUsers, newUsers, totalMeasurements, totalAiAnalyses] =
        await Promise.all([
          // Total users overall
          this.prisma.user.count({
            where: { deletedAt: null },
          }),

          // New users created during the past month
          this.prisma.user.count({
            where: {
              createdAt: { gte: monthStart, lt: monthEnd },
              deletedAt: null,
            },
          }),

          // Measurements recorded during the past month
          this.prisma.bpMeasurement.count({
            where: {
              createdAt: { gte: monthStart, lt: monthEnd },
            },
          }),

          // AI analyses created during the past month
          this.prisma.aiAnalysis.count({
            where: {
              createdAt: { gte: monthStart, lt: monthEnd },
            },
          }),
        ]);

      const monthLabel = monthStart.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
      });

      this.logger.log('='.repeat(60));
      this.logger.log(`Monthly Stats Report — ${monthLabel}`);
      this.logger.log('='.repeat(60));
      this.logger.log(`Total users (active):       ${totalUsers}`);
      this.logger.log(`New users this month:        ${newUsers}`);
      this.logger.log(`Measurements this month:     ${totalMeasurements}`);
      this.logger.log(`AI analyses this month:      ${totalAiAnalyses}`);
      this.logger.log('='.repeat(60));
      this.logger.log(
        `Monthly stats job completed (${Date.now() - start}ms)`,
      );
    } catch (error) {
      this.logger.error(
        `Monthly stats job failed: ${error.message}`,
        error.stack,
      );
    }
  }
}
