import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { CreditService } from '../credit/credit.service';
import { EmailService } from '../../core/email/email.service';
import { SubscriptionPlan } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly subscriptionService: SubscriptionService,
    private readonly creditService: CreditService,
    private readonly emailService: EmailService,
  ) {}

  // ─── User management ───

  async getUsers(page: number = 1, limit: number = 20, role?: string, search?: string) {
    const where: any = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { patient: { firstName: { contains: search, mode: 'insensitive' } } },
        { patient: { lastName: { contains: search, mode: 'insensitive' } } },
        { doctor: { firstName: { contains: search, mode: 'insensitive' } } },
        { doctor: { lastName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          emailVerified: true,
          lastLoginAt: true,
          createdAt: true,
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              creditBalance: { select: { balance: true } },
              subscriptions: {
                where: { status: 'ACTIVE', endDate: { gt: new Date() } },
                select: { id: true, plan: true, status: true, endDate: true },
                take: 1,
                orderBy: { endDate: 'desc' },
              },
            },
          },
          doctor: {
            select: {
              id: true,
              userId: true,
              firstName: true,
              lastName: true,
              specialty: true,
              verificationStatus: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data: users, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async updateUserStatus(userId: string, status: any, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status },
    });

    await this.auditService.log({
      userId: adminId,
      userRole: 'ADMIN',
      action: 'UPDATE',
      resourceType: 'user',
      resourceId: userId,
      details: { previousStatus: user.status, newStatus: status },
    });

    return updated;
  }

  async deleteUser(userId: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur non trouve');
    if (user.id === adminId) throw new BadRequestException('Vous ne pouvez pas supprimer votre propre compte');

    // Cascade delete: Prisma onDelete: Cascade handles related records
    await this.prisma.user.delete({ where: { id: userId } });

    await this.auditService.log({
      userId: adminId,
      userRole: 'ADMIN',
      action: 'DELETE',
      resourceType: 'user',
      resourceId: userId,
      details: { email: user.email, role: user.role },
    });

    return { message: 'Utilisateur supprime avec succes' };
  }

  // ─── Grant subscription (admin) ───

  async grantSubscription(
    userId: string,
    plan: string,
    durationDays: number = 365,
    adminId: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { patient: true },
    });

    if (!user) throw new NotFoundException('Utilisateur non trouve');
    if (user.role !== 'PATIENT') throw new BadRequestException('Seuls les patients peuvent recevoir un abonnement');
    if (!user.patient) throw new BadRequestException('Profil patient non trouve');

    const subscription = await this.subscriptionService.grantSubscription(
      user.patient.id,
      plan as SubscriptionPlan,
      durationDays,
    );

    await this.auditService.log({
      userId: adminId,
      userRole: 'ADMIN',
      action: 'CREATE',
      resourceType: 'subscription_grant',
      resourceId: subscription.id,
      details: { patientUserId: userId, plan, durationDays },
    });

    return subscription;
  }

  // ─── Bonus credits (admin) ───

  async addBonusCredits(
    userId: string,
    amount: number,
    description: string,
    adminId: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { patient: true },
    });

    if (!user) throw new NotFoundException('Utilisateur non trouve');
    if (user.role !== 'PATIENT') throw new BadRequestException('Seuls les patients peuvent recevoir des credits bonus');
    if (!user.patient) throw new BadRequestException('Profil patient non trouve');

    const transaction = await this.creditService.addBonus(
      user.patient.id,
      amount,
      description,
    );

    await this.auditService.log({
      userId: adminId,
      userRole: 'ADMIN',
      action: 'CREATE',
      resourceType: 'bonus_credits',
      resourceId: user.patient.id,
      details: { amount, description },
    });

    return transaction;
  }

  // ─── Admin-Doctor messaging ───

  async sendMessageToDoctor(
    doctorUserId: string,
    subject: string,
    content: string,
    priority: 'NORMAL' | 'URGENT',
    adminId: string,
  ) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { userId: doctorUserId },
      include: { user: { select: { email: true } } },
    });
    if (!doctor) throw new NotFoundException('Medecin non trouve');

    const message = await this.prisma.adminMessage.create({
      data: {
        senderId: adminId,
        recipientId: doctorUserId,
        subject,
        content,
        priority,
      },
    });

    // Send email for URGENT messages
    if (priority === 'URGENT') {
      try {
        await this.emailService.sendEmail(
          doctor.user.email,
          `[URGENT] ${subject}`,
          `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#dc2626;color:white;padding:15px 20px;border-radius:8px 8px 0 0;">
              <h2 style="margin:0;">🚨 Message urgent de l'administration</h2>
            </div>
            <div style="background:#fff;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px;">
              <p style="font-size:16px;color:#111;">${content}</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
              <p style="font-size:12px;color:#6b7280;">T-Cardio Pro - Administration</p>
            </div>
          </div>`,
        );
      } catch (err) {
        // Don't fail message creation if email fails
      }
    }

    await this.auditService.log({
      userId: adminId,
      userRole: 'ADMIN',
      action: 'CREATE',
      resourceType: 'admin_message',
      resourceId: message.id,
      details: { recipientId: doctorUserId, priority },
    });

    return message;
  }

  async getMessagesSent(adminId: string, page: number = 1, limit: number = 20) {
    const [data, total] = await Promise.all([
      this.prisma.adminMessage.findMany({
        where: { senderId: adminId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.adminMessage.count({ where: { senderId: adminId } }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getDoctorsForContact() {
    return this.prisma.doctor.findMany({
      where: { verificationStatus: 'VERIFIED' },
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        specialty: true,
        user: { select: { email: true, status: true } },
      },
      orderBy: { lastName: 'asc' },
    });
  }

  // ─── Doctor verification ───

  async getPendingDoctors() {
    return this.prisma.doctor.findMany({
      where: { verificationStatus: 'PENDING' },
      include: { user: { select: { email: true, createdAt: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async verifyDoctor(doctorId: string, approved: boolean, adminId: string) {
    const doctor = await this.prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor) throw new NotFoundException('Doctor not found');

    const status = approved ? 'VERIFIED' : 'REJECTED';

    const updated = await this.prisma.doctor.update({
      where: { id: doctorId },
      data: {
        verificationStatus: status,
        verifiedBy: adminId,
        verifiedAt: new Date(),
      },
    });

    // Activate user account if approved
    if (approved) {
      await this.prisma.user.update({
        where: { id: doctor.userId },
        data: { status: 'ACTIVE' },
      });
    }

    await this.auditService.log({
      userId: adminId,
      userRole: 'ADMIN',
      action: 'UPDATE',
      resourceType: 'doctor_verification',
      resourceId: doctorId,
      details: { approved, status },
    });

    return updated;
  }

  // ─── Global statistics ───

  async getGlobalStats() {
    const [
      totalUsers,
      totalPatients,
      totalDoctors,
      totalMeasurements,
      totalAiAnalyses,
      totalAlerts,
      activeEmergencies,
      pendingDoctors,
    ] = await Promise.all([
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.patient.count(),
      this.prisma.doctor.count({ where: { verificationStatus: 'VERIFIED' } }),
      this.prisma.bpMeasurement.count(),
      this.prisma.aiAnalysis.count({ where: { errorMessage: null } }),
      this.prisma.alert.count(),
      this.prisma.emergencyEvent.count({ where: { status: 'ACTIVE' } }),
      this.prisma.doctor.count({ where: { verificationStatus: 'PENDING' } }),
    ]);

    // Last 30 days
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [recentMeasurements, recentAnalyses] = await Promise.all([
      this.prisma.bpMeasurement.count({ where: { createdAt: { gte: since } } }),
      this.prisma.aiAnalysis.count({ where: { createdAt: { gte: since }, errorMessage: null } }),
    ]);

    return {
      totalUsers,
      totalPatients,
      totalDoctors,
      totalMeasurements,
      totalAiAnalyses,
      totalAlerts,
      activeEmergencies,
      pendingDoctors,
      last30Days: { measurements: recentMeasurements, aiAnalyses: recentAnalyses },
    };
  }

  // ─── AI Thresholds ───

  async getAiThresholds() {
    return this.prisma.aiThreshold.findMany({ orderBy: { priority: 'asc' } });
  }

  async updateAiThreshold(id: string, data: any, adminId: string) {
    const updated = await this.prisma.aiThreshold.update({ where: { id }, data });

    await this.auditService.log({
      userId: adminId,
      userRole: 'ADMIN',
      action: 'UPDATE',
      resourceType: 'ai_threshold',
      resourceId: id,
      details: data,
    });

    return updated;
  }

  // ─── Audit logs ───

  async getAuditLogs(page: number = 1, limit: number = 50, resourceType?: string) {
    const where: any = {};
    if (resourceType) where.resourceType = resourceType;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data: logs, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  // ─── Advanced Stats ───

  async getRevenueStats(days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const payments: any[] = await this.prisma.$queryRaw`
      SELECT DATE(created_at) as date, SUM(amount_xof) as total
      FROM payments
      WHERE status = 'COMPLETED' AND created_at >= ${since}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.total), 0);

    // Monthly revenue for current month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthlyRevenue = await this.prisma.payment.aggregate({
      where: { status: 'COMPLETED', createdAt: { gte: monthStart } },
      _sum: { amountXof: true },
    });

    return {
      daily: payments.map((p) => ({ date: p.date, total: Number(p.total) })),
      totalRevenue,
      monthlyRevenue: monthlyRevenue._sum.amountXof || 0,
    };
  }

  async getUserGrowthStats(days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const growth: any[] = await this.prisma.$queryRaw`
      SELECT DATE(created_at) as date, COUNT(*)::int as count
      FROM users
      WHERE created_at >= ${since}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    const totalNewUsers = growth.reduce((sum, g) => sum + Number(g.count), 0);

    return {
      daily: growth.map((g) => ({ date: g.date, count: Number(g.count) })),
      totalNewUsers,
    };
  }

  async getSubscriptionStats() {
    const [activeByPlan, expired, totalUsers] = await Promise.all([
      this.prisma.subscription.groupBy({
        by: ['plan'],
        where: { status: 'ACTIVE' },
        _count: { id: true },
      }),
      this.prisma.subscription.count({ where: { status: 'EXPIRED' } }),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
    ]);

    const activeTotal = activeByPlan.reduce((sum, s) => sum + s._count.id, 0);

    return {
      plans: activeByPlan.map((s) => ({ plan: s.plan, count: s._count.id })),
      activeTotal,
      expired,
      withoutSubscription: totalUsers - activeTotal,
    };
  }

  async getTopDoctors(limit: number = 5) {
    const doctors = await this.prisma.doctor.findMany({
      where: { verificationStatus: 'VERIFIED' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        specialty: true,
        averageRating: true,
        totalRatings: true,
        _count: {
          select: {
            teleconsultations: { where: { status: 'ENDED' } },
          },
        },
        wallet: { select: { balance: true } },
      },
      orderBy: { teleconsultations: { _count: 'desc' } },
      take: limit,
    });

    return doctors.map((d) => ({
      id: d.id,
      name: `Dr. ${d.firstName} ${d.lastName}`,
      specialty: d.specialty,
      consultations: d._count.teleconsultations,
      walletBalance: d.wallet?.balance || 0,
      averageRating: d.averageRating,
      totalRatings: d.totalRatings,
    }));
  }
}
