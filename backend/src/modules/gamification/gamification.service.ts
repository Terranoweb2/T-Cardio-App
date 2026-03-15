import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateGoalDto } from './dto/create-goal.dto';

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── XP Profile ────────────────────────────────────────────────────

  /**
   * Get or create the PatientXp record for a given patient.
   */
  async getProfile(patientId: string) {
    const xp = await this.prisma.patientXp.upsert({
      where: { patientId },
      create: { patientId },
      update: {},
    });

    return {
      totalXp: xp.totalXp,
      level: xp.level,
      streak: xp.streak,
      longestStreak: xp.longestStreak,
      lastActivityAt: xp.lastActivityAt,
    };
  }

  // ─── Achievements ──────────────────────────────────────────────────

  /**
   * List all achievements for a patient, including badge details.
   */
  async getAchievements(patientId: string) {
    return this.prisma.achievement.findMany({
      where: { patientId },
      include: { badge: true },
      orderBy: { unlockedAt: 'desc' },
    });
  }

  // ─── Badges ────────────────────────────────────────────────────────

  /**
   * List all badge definitions.
   */
  async getAllBadges() {
    return this.prisma.badge.findMany({
      orderBy: { category: 'asc' },
    });
  }

  // ─── Health Goals ──────────────────────────────────────────────────

  /**
   * List active and completed goals for a patient.
   */
  async getGoals(patientId: string) {
    return this.prisma.healthGoal.findMany({
      where: {
        patientId,
        status: { in: ['GOAL_ACTIVE', 'GOAL_COMPLETED'] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create a new health goal for a patient.
   */
  async createGoal(patientId: string, dto: CreateGoalDto) {
    return this.prisma.healthGoal.create({
      data: {
        patientId,
        type: dto.type,
        title: dto.title,
        description: dto.description,
        targetValue: dto.targetValue,
        unit: dto.unit,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      },
    });
  }

  /**
   * Update the current progress of a goal.
   * If the target is reached, mark the goal as completed and award 50 XP.
   */
  async updateGoalProgress(patientId: string, goalId: string, newValue: number) {
    const goal = await this.prisma.healthGoal.findFirst({
      where: { id: goalId, patientId },
    });

    if (!goal) {
      throw new NotFoundException('Objectif introuvable');
    }

    if (goal.status !== 'GOAL_ACTIVE') {
      throw new BadRequestException('Cet objectif n\'est plus actif');
    }

    const isCompleted = newValue >= goal.targetValue;

    const updated = await this.prisma.healthGoal.update({
      where: { id: goalId },
      data: {
        currentValue: newValue,
        ...(isCompleted && {
          status: 'GOAL_COMPLETED',
          completedAt: new Date(),
        }),
      },
    });

    // Award 50 XP when goal is completed
    if (isCompleted) {
      await this.addXp(patientId, 50);
      this.logger.log(`Objectif complete pour le patient ${patientId}: ${goal.title}`);
    }

    return updated;
  }

  // ─── Event Handlers ────────────────────────────────────────────────

  /**
   * Called after a blood pressure measurement is saved.
   * Updates streak, awards XP, and checks measurement-related badges.
   */
  async onMeasurement(patientId: string): Promise<void> {
    // 1. Get or create PatientXp
    const xp = await this.prisma.patientXp.upsert({
      where: { patientId },
      create: { patientId, streak: 1, totalXp: 5, lastActivityAt: new Date() },
      update: {},
    });

    // 2. Update streak based on last activity date
    const now = new Date();
    const today = this.startOfDay(now);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let newStreak = xp.streak;
    let newLongest = xp.longestStreak;
    let skipXp = false;

    if (xp.lastActivityAt) {
      const lastDay = this.startOfDay(xp.lastActivityAt);

      if (lastDay.getTime() === today.getTime()) {
        // Already recorded today — skip streak update and XP
        skipXp = true;
      } else if (lastDay.getTime() === yesterday.getTime()) {
        // Consecutive day — increment streak
        newStreak = xp.streak + 1;
      } else {
        // Gap — reset streak
        newStreak = 1;
      }
    } else {
      // First ever activity
      newStreak = 1;
    }

    // 3. Update longest streak
    if (newStreak > newLongest) {
      newLongest = newStreak;
    }

    // 4. Add 5 XP for measurement (unless already measured today)
    const xpToAdd = skipXp ? 0 : 5;
    const newTotalXp = xp.totalXp + xpToAdd;

    // 5. Recalculate level
    const newLevel = Math.floor(newTotalXp / 100) + 1;

    await this.prisma.patientXp.update({
      where: { patientId },
      data: {
        streak: newStreak,
        longestStreak: newLongest,
        totalXp: newTotalXp,
        level: newLevel,
        lastActivityAt: now,
      },
    });

    // 6. Check badge criteria
    const measurementCount = await this.prisma.bpMeasurement.count({
      where: { patientId },
    });

    // Measurement count badges
    if (measurementCount >= 1) {
      await this.awardBadge(patientId, 'FIRST_MEASURE');
    }
    if (measurementCount >= 10) {
      await this.awardBadge(patientId, '10_MEASURES');
    }
    if (measurementCount >= 50) {
      await this.awardBadge(patientId, '50_MEASURES');
    }

    // Streak badges
    if (newStreak >= 7) {
      await this.awardBadge(patientId, '7_DAY_STREAK');
    }
    if (newStreak >= 30) {
      await this.awardBadge(patientId, '30_DAY_STREAK');
    }
  }

  /**
   * Called after a medication log is recorded.
   * Awards XP and checks medication-related badges.
   */
  async onMedicationLog(patientId: string): Promise<void> {
    // 1. Add 3 XP
    await this.addXp(patientId, 3);

    // 2. Check FIRST_MED_LOG badge
    const totalLogs = await this.prisma.medicationLog.count({
      where: {
        medication: { patientId },
      },
    });

    if (totalLogs >= 1) {
      await this.awardBadge(patientId, 'FIRST_MED_LOG');
    }

    // 3. Check 7-day adherence for MED_ADHERENCE_90
    await this.checkMedAdherence(patientId);
  }

  // ─── Leaderboard ───────────────────────────────────────────────────

  /**
   * Get the top patients by total XP.
   */
  async getLeaderboard(limit: number = 10) {
    const entries = await this.prisma.patientXp.findMany({
      take: limit,
      orderBy: { totalXp: 'desc' },
      include: {
        patient: {
          select: { id: true, firstName: true },
        },
      },
    });

    return entries.map((entry) => ({
      patientId: entry.patientId,
      firstName: entry.patient.firstName,
      totalXp: entry.totalXp,
      level: entry.level,
      streak: entry.streak,
    }));
  }

  // ─── Private Helpers ───────────────────────────────────────────────

  /**
   * Award a badge to a patient if they don't already have it.
   * Also adds the badge's XP reward to the patient's total.
   * Returns true if the badge was newly awarded, false if already owned.
   */
  private async awardBadge(patientId: string, badgeCode: string): Promise<boolean> {
    const badge = await this.prisma.badge.findUnique({
      where: { code: badgeCode },
    });

    if (!badge) {
      this.logger.warn(`Badge introuvable: ${badgeCode}`);
      return false;
    }

    // Check if already awarded (unique constraint on [patientId, badgeId])
    const existing = await this.prisma.achievement.findUnique({
      where: { patientId_badgeId: { patientId, badgeId: badge.id } },
    });

    if (existing) {
      return false;
    }

    // Create achievement
    await this.prisma.achievement.create({
      data: {
        patientId,
        badgeId: badge.id,
      },
    });

    // Add badge XP reward
    await this.addXp(patientId, badge.xpReward);

    this.logger.log(`Badge "${badge.name}" debloque pour le patient ${patientId}`);
    return true;
  }

  /**
   * Add XP to a patient and recalculate their level.
   */
  private async addXp(patientId: string, amount: number): Promise<void> {
    const xp = await this.prisma.patientXp.upsert({
      where: { patientId },
      create: { patientId, totalXp: amount, level: Math.floor(amount / 100) + 1 },
      update: {
        totalXp: { increment: amount },
      },
    });

    // Recalculate level after increment
    const updatedXp = await this.prisma.patientXp.findUnique({
      where: { patientId },
    });

    if (updatedXp) {
      const newLevel = Math.floor(updatedXp.totalXp / 100) + 1;
      if (newLevel !== updatedXp.level) {
        await this.prisma.patientXp.update({
          where: { patientId },
          data: { level: newLevel },
        });
      }
    }
  }

  /**
   * Check 7-day medication adherence and award MED_ADHERENCE_90 badge if >= 90%.
   */
  private async checkMedAdherence(patientId: string): Promise<void> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get all medication logs for this patient in the last 7 days
    const logs = await this.prisma.medicationLog.findMany({
      where: {
        medication: { patientId },
        scheduledAt: { gte: sevenDaysAgo },
      },
    });

    if (logs.length === 0) return;

    const takenCount = logs.filter((log) => log.status === 'TAKEN').length;
    const adherencePercent = (takenCount / logs.length) * 100;

    if (adherencePercent >= 90) {
      await this.awardBadge(patientId, 'MED_ADHERENCE_90');
    }
  }

  /**
   * Return the start of day (midnight) for a given date, in UTC.
   */
  private startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
}
