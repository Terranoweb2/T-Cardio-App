import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the currently active subscription for a patient.
   */
  async getActiveSubscription(patientId: string) {
    return this.prisma.subscription.findFirst({
      where: {
        patientId,
        status: SubscriptionStatus.ACTIVE,
        endDate: { gt: new Date() },
      },
      orderBy: { endDate: 'desc' },
    });
  }

  /**
   * Check if the patient has an active, non-expired subscription.
   */
  async hasActiveSubscription(patientId: string): Promise<boolean> {
    const sub = await this.getActiveSubscription(patientId);
    return !!sub;
  }

  /**
   * Get the latest subscription (any status) for display.
   */
  async getLatestSubscription(patientId: string) {
    return this.prisma.subscription.findFirst({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: { payment: true },
    });
  }

  /**
   * Activate a subscription after successful payment.
   */
  async activateSubscription(
    patientId: string,
    plan: SubscriptionPlan,
    paymentId: string,
    priceXof: number,
  ) {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 365); // 1 year

    // Cancel any existing active subscriptions
    await this.prisma.subscription.updateMany({
      where: {
        patientId,
        status: SubscriptionStatus.ACTIVE,
      },
      data: {
        status: SubscriptionStatus.EXPIRED,
      },
    });

    const subscription = await this.prisma.subscription.create({
      data: {
        patientId,
        plan,
        status: SubscriptionStatus.ACTIVE,
        priceXof,
        startDate: now,
        endDate,
        paymentId,
      },
    });

    this.logger.log(
      `Subscription activated: patient=${patientId}, plan=${plan}, expires=${endDate.toISOString()}`,
    );

    return subscription;
  }

  /**
   * Cancel a subscription.
   */
  async cancelSubscription(patientId: string, reason?: string) {
    const active = await this.getActiveSubscription(patientId);
    if (!active) {
      throw new BadRequestException('Aucun abonnement actif a annuler');
    }

    const updated = await this.prisma.subscription.update({
      where: { id: active.id },
      data: {
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: reason || 'Annule par le patient',
      },
    });

    this.logger.log(`Subscription cancelled: patient=${patientId}, id=${active.id}`);
    return updated;
  }

  /**
   * Expire overdue subscriptions (cron job).
   * Called daily — sets ACTIVE subscriptions past endDate to EXPIRED.
   */
  async expireOverdueSubscriptions(): Promise<number> {
    const now = new Date();
    const result = await this.prisma.subscription.updateMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        endDate: { lt: now },
      },
      data: {
        status: SubscriptionStatus.EXPIRED,
      },
    });

    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} overdue subscription(s)`);
    }

    return result.count;
  }

  /**
   * Find subscriptions expiring within N days (for reminder emails).
   */
  async findExpiringSubscriptions(withinDays: number) {
    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + withinDays);

    return this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        endDate: {
          gt: now,
          lte: futureDate,
        },
      },
      include: {
        patient: {
          include: {
            user: { select: { email: true } },
          },
        },
      },
    });
  }

  /**
   * Admin: grant a free subscription to a patient (no payment required).
   */
  async grantSubscription(
    patientId: string,
    plan: SubscriptionPlan,
    durationDays: number = 365,
  ) {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + durationDays);

    // Expire any existing active subscriptions
    await this.prisma.subscription.updateMany({
      where: {
        patientId,
        status: SubscriptionStatus.ACTIVE,
      },
      data: {
        status: SubscriptionStatus.EXPIRED,
      },
    });

    const subscription = await this.prisma.subscription.create({
      data: {
        patientId,
        plan,
        status: SubscriptionStatus.ACTIVE,
        priceXof: 0, // Granted for free by admin
        startDate: now,
        endDate,
      },
    });

    this.logger.log(
      `Subscription granted (admin): patient=${patientId}, plan=${plan}, duration=${durationDays}d, expires=${endDate.toISOString()}`,
    );

    return subscription;
  }

  /**
   * Admin: get all subscriptions with pagination.
   */
  async getAllSubscriptions(page = 1, limit = 20, status?: SubscriptionStatus) {
    const where = status ? { status } : {};

    const [data, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        include: {
          patient: {
            select: { firstName: true, lastName: true, user: { select: { email: true } } },
          },
          payment: { select: { id: true, amountXof: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.subscription.count({ where }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
