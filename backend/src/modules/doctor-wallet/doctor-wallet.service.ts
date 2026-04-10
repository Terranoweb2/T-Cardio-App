import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { DoctorTransactionType } from '@prisma/client';

@Injectable()
export class DoctorWalletService {
  private readonly logger = new Logger(DoctorWalletService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ensure a DoctorWallet record exists. Creates one with 0 balance if not found.
   */
  async ensureWallet(doctorId: string) {
    return this.prisma.doctorWallet.upsert({
      where: { doctorId },
      update: {},
      create: { doctorId, balance: 0 },
    });
  }

  /**
   * Get the current wallet balance for a doctor.
   */
  async getBalance(doctorId: string): Promise<number> {
    const wallet = await this.ensureWallet(doctorId);
    return wallet.balance;
  }

  /**
   * Credit doctor for a completed teleconsultation.
   * Earning = price * (1 - commissionPct / 100). Defaults: price=5000, commission=20%.
   */
  async creditForTeleconsultation(
    doctorId: string,
    teleconsultationId: string,
    price: number = 5000,
    commissionPct: number = 20,
  ) {
    const earning = Math.round(price * (1 - commissionPct / 100));
    return this.credit(
      doctorId,
      earning,
      DoctorTransactionType.EARNING_TELECONSULTATION,
      teleconsultationId,
      'TELECONSULTATION',
      `Teleconsultation #${teleconsultationId.slice(0, 8)}`,
    );
  }

  /**
   * Credit doctor for a paid messaging session.
   * Amount is the patient-facing price minus the platform commission.
   */
  async creditForMessaging(doctorId: string, amount: number, conversationId: string) {
    return this.credit(
      doctorId,
      amount,
      DoctorTransactionType.EARNING_MESSAGING,
      conversationId,
      'MESSAGING',
      `Session messagerie #${conversationId.slice(0, 8)}`,
    );
  }

  /**
   * Credit doctor for a paid emergency call (10% of 1000 = 100 XOF).
   */
  async creditForEmergency(doctorId: string, emergencyEventId: string) {
    const earning = 100; // 10% of 1000 XOF
    return this.credit(
      doctorId,
      earning,
      DoctorTransactionType.EARNING_EMERGENCY,
      emergencyEventId,
      'EMERGENCY',
      `Urgence payante #${emergencyEventId.slice(0, 8)}`,
    );
  }

  /**
   * Admin adjustment (positive or negative).
   */
  async adminAdjust(doctorId: string, amount: number, reason: string, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.doctorWallet.upsert({
        where: { doctorId },
        update: {},
        create: { doctorId, balance: 0 },
      });

      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore + amount;

      if (balanceAfter < 0) {
        throw new BadRequestException(
          `Solde insuffisant: ${balanceBefore} + (${amount}) = ${balanceAfter}`,
        );
      }

      await tx.doctorWallet.update({
        where: { doctorId },
        data: { balance: balanceAfter },
      });

      const transaction = await tx.doctorTransaction.create({
        data: {
          doctorWalletId: wallet.id,
          type: DoctorTransactionType.ADMIN_ADJUSTMENT,
          amount,
          balanceBefore,
          balanceAfter,
          description: `Ajustement admin: ${reason} (par ${adminId.slice(0, 8)})`,
        },
      });

      this.logger.log(
        `Admin adjustment: doctor=${doctorId}, amount=${amount}, reason="${reason}", admin=${adminId}`,
      );

      return transaction;
    });
  }

  /**
   * Get paginated transaction history for a doctor.
   */
  async getTransactions(doctorId: string, page = 1, limit = 20) {
    const wallet = await this.ensureWallet(doctorId);

    const [transactions, total] = await Promise.all([
      this.prisma.doctorTransaction.findMany({
        where: { doctorWalletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.doctorTransaction.count({
        where: { doctorWalletId: wallet.id },
      }),
    ]);

    return {
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Earnings stats for the frontend wallet page.
   */
  async getStats(doctorId: string) {
    const wallet = await this.ensureWallet(doctorId);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const weekStart = new Date(todayStart);
    const day = weekStart.getDay();
    weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1)); // Monday

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const earningTypes = [
      DoctorTransactionType.EARNING_TELECONSULTATION,
      DoctorTransactionType.EARNING_EMERGENCY,
      DoctorTransactionType.EARNING_MESSAGING,
    ];

    const [todayEarnings, weekEarnings, monthEarnings, totalConsultations, totalEmergencies, totalMessagingSessions] =
      await Promise.all([
        this.sumEarnings(wallet.id, earningTypes, todayStart),
        this.sumEarnings(wallet.id, earningTypes, weekStart),
        this.sumEarnings(wallet.id, earningTypes, monthStart),
        this.prisma.doctorTransaction.count({
          where: {
            doctorWalletId: wallet.id,
            type: DoctorTransactionType.EARNING_TELECONSULTATION,
          },
        }),
        this.prisma.doctorTransaction.count({
          where: {
            doctorWalletId: wallet.id,
            type: DoctorTransactionType.EARNING_EMERGENCY,
          },
        }),
        this.prisma.doctorTransaction.count({
          where: {
            doctorWalletId: wallet.id,
            type: DoctorTransactionType.EARNING_MESSAGING,
          },
        }),
      ]);

    return {
      balance: wallet.balance,
      todayEarnings,
      weekEarnings,
      monthEarnings,
      totalConsultations,
      totalEmergencies,
      totalMessagingSessions,
    };
  }

  // ─── Withdrawals ───

  async requestWithdrawal(
    doctorId: string,
    amount: number,
    mobileMoneyPhone: string,
    mobileMoneyOperator: string,
  ) {
    if (amount < 5000) {
      throw new BadRequestException('Le montant minimum de retrait est de 5 000 XOF');
    }

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.doctorWallet.upsert({
        where: { doctorId },
        update: {},
        create: { doctorId, balance: 0 },
      });

      if (wallet.balance < amount) {
        throw new BadRequestException(
          `Solde insuffisant: ${wallet.balance} XOF disponible, ${amount} XOF demande`,
        );
      }

      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore - amount;

      await tx.doctorWallet.update({
        where: { doctorId },
        data: { balance: balanceAfter },
      });

      await tx.doctorTransaction.create({
        data: {
          doctorWalletId: wallet.id,
          type: DoctorTransactionType.WITHDRAWAL,
          amount: -amount,
          balanceBefore,
          balanceAfter,
          description: `Retrait ${mobileMoneyOperator} ${mobileMoneyPhone}`,
        },
      });

      const withdrawal = await tx.doctorWithdrawal.create({
        data: {
          doctorId,
          amount,
          mobileMoneyPhone,
          mobileMoneyOperator,
          status: 'PENDING',
        },
      });

      // Save mobile money info on doctor profile
      await tx.doctor.update({
        where: { id: doctorId },
        data: { mobileMoneyPhone, mobileMoneyOperator },
      });

      this.logger.log(
        `Withdrawal requested: doctor=${doctorId}, amount=${amount}, phone=${mobileMoneyPhone}, operator=${mobileMoneyOperator}`,
      );

      return withdrawal;
    });
  }

  async getWithdrawals(doctorId: string, page = 1, limit = 20) {
    const [withdrawals, total] = await Promise.all([
      this.prisma.doctorWithdrawal.findMany({
        where: { doctorId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.doctorWithdrawal.count({ where: { doctorId } }),
    ]);

    return {
      data: withdrawals,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getAllWithdrawals(page = 1, limit = 20, status?: string) {
    const where: any = {};
    if (status) where.status = status;

    const [withdrawals, total] = await Promise.all([
      this.prisma.doctorWithdrawal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          doctor: { select: { firstName: true, lastName: true, practicePhone: true } },
        },
      }),
      this.prisma.doctorWithdrawal.count({ where }),
    ]);

    return {
      data: withdrawals,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async processWithdrawal(
    withdrawalId: string,
    adminId: string,
    action: 'approve' | 'reject',
    reason?: string,
  ) {
    const withdrawal = await this.prisma.doctorWithdrawal.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) throw new NotFoundException('Retrait non trouve');
    if (withdrawal.status !== 'PENDING') {
      throw new BadRequestException('Ce retrait a deja ete traite');
    }

    if (action === 'approve') {
      return this.prisma.doctorWithdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: 'COMPLETED',
          processedBy: adminId,
          processedAt: new Date(),
        },
      });
    }

    // Reject: refund the balance
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.doctorWithdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: 'REJECTED',
          failureReason: reason || 'Rejete par l\'administrateur',
          processedBy: adminId,
          processedAt: new Date(),
        },
      });

      // Refund wallet
      const wallet = await tx.doctorWallet.findUnique({
        where: { doctorId: withdrawal.doctorId },
      });

      if (wallet) {
        const balanceBefore = wallet.balance;
        const balanceAfter = balanceBefore + withdrawal.amount;

        await tx.doctorWallet.update({
          where: { doctorId: withdrawal.doctorId },
          data: { balance: balanceAfter },
        });

        await tx.doctorTransaction.create({
          data: {
            doctorWalletId: wallet.id,
            type: DoctorTransactionType.ADMIN_ADJUSTMENT,
            amount: withdrawal.amount,
            balanceBefore,
            balanceAfter,
            description: `Remboursement retrait rejete: ${reason || 'Rejete'}`,
            referenceId: withdrawalId,
            referenceType: 'WITHDRAWAL_REFUND',
          },
        });
      }

      this.logger.log(
        `Withdrawal ${action}: id=${withdrawalId}, admin=${adminId}, amount=${withdrawal.amount}`,
      );

      return updated;
    });
  }

  // ─── Private helper ───

  private async credit(
    doctorId: string,
    amount: number,
    type: DoctorTransactionType,
    referenceId: string,
    referenceType: string,
    description: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.doctorWallet.upsert({
        where: { doctorId },
        update: {},
        create: { doctorId, balance: 0 },
      });

      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore + amount;

      await tx.doctorWallet.update({
        where: { doctorId },
        data: { balance: balanceAfter },
      });

      const transaction = await tx.doctorTransaction.create({
        data: {
          doctorWalletId: wallet.id,
          type,
          amount,
          balanceBefore,
          balanceAfter,
          description,
          referenceId,
          referenceType,
        },
      });

      this.logger.log(
        `Doctor wallet credited: doctor=${doctorId}, amount=+${amount}, balance=${balanceBefore}->${balanceAfter}, ref=${referenceType}:${referenceId.slice(0, 8)}`,
      );

      return transaction;
    });
  }

  private async sumEarnings(
    walletId: string,
    types: DoctorTransactionType[],
    since: Date,
  ): Promise<number> {
    const result = await this.prisma.doctorTransaction.aggregate({
      where: {
        doctorWalletId: walletId,
        type: { in: types },
        createdAt: { gte: since },
      },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  }
}
