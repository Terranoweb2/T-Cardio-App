import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreditTransactionType, Prisma } from '@prisma/client';

@Injectable()
export class CreditService {
  private readonly logger = new Logger(CreditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ensure a CreditBalance record exists for the patient.
   * Creates one with 0 balance if not found.
   */
  async ensureBalance(patientId: string) {
    return this.prisma.creditBalance.upsert({
      where: { patientId },
      update: {},
      create: { patientId, balance: 0 },
    });
  }

  /**
   * Get the current credit balance for a patient.
   */
  async getBalance(patientId: string): Promise<number> {
    const cb = await this.ensureBalance(patientId);
    return cb.balance;
  }

  /**
   * Check if patient has enough credits.
   */
  async hasSufficientCredits(patientId: string, amount: number): Promise<boolean> {
    const balance = await this.getBalance(patientId);
    return balance >= amount;
  }

  /**
   * Add credits to a patient's balance (after successful payment).
   * Uses Prisma interactive transaction for atomicity.
   */
  async addCredits(
    patientId: string,
    amount: number,
    paymentId?: string,
    description?: string,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Le montant doit etre positif');
    }

    return this.prisma.$transaction(async (tx) => {
      // Ensure balance exists
      const cb = await tx.creditBalance.upsert({
        where: { patientId },
        update: {},
        create: { patientId, balance: 0 },
      });

      const balanceBefore = cb.balance;
      const balanceAfter = balanceBefore + amount;

      // Update balance
      await tx.creditBalance.update({
        where: { patientId },
        data: { balance: balanceAfter },
      });

      // Create transaction record
      const transaction = await tx.creditTransaction.create({
        data: {
          creditBalanceId: cb.id,
          type: CreditTransactionType.PURCHASE,
          amount,
          balanceBefore,
          balanceAfter,
          description: description || `Achat de ${amount} credits`,
          paymentId,
        },
      });

      this.logger.log(
        `Credits added: patient=${patientId}, amount=+${amount}, balance=${balanceBefore}->${balanceAfter}`,
      );

      return transaction;
    });
  }

  /**
   * Add bonus credits (no payment associated).
   */
  async addBonus(patientId: string, amount: number, description: string) {
    if (amount <= 0) {
      throw new BadRequestException('Le montant du bonus doit etre positif');
    }

    return this.prisma.$transaction(async (tx) => {
      const cb = await tx.creditBalance.upsert({
        where: { patientId },
        update: {},
        create: { patientId, balance: 0 },
      });

      const balanceBefore = cb.balance;
      const balanceAfter = balanceBefore + amount;

      await tx.creditBalance.update({
        where: { patientId },
        data: { balance: balanceAfter },
      });

      return tx.creditTransaction.create({
        data: {
          creditBalanceId: cb.id,
          type: CreditTransactionType.BONUS,
          amount,
          balanceBefore,
          balanceAfter,
          description,
        },
      });
    });
  }

  /**
   * Deduct credits for a teleconsultation (5000 XOF).
   */
  async deductForTeleconsultation(patientId: string, teleconsultationId: string) {
    const cost = 5000;
    return this.deduct(
      patientId,
      cost,
      CreditTransactionType.DEBIT_TELECONSULTATION,
      teleconsultationId,
      'TELECONSULTATION',
      `Teleconsultation #${teleconsultationId.slice(0, 8)}`,
    );
  }

  /**
   * Deduct credits for a paid emergency call (1000 XOF).
   */
  async deductForEmergency(patientId: string, emergencyEventId: string) {
    const cost = 1000;
    return this.deduct(
      patientId,
      cost,
      CreditTransactionType.DEBIT_EMERGENCY,
      emergencyEventId,
      'EMERGENCY',
      `Appel urgence #${emergencyEventId.slice(0, 8)}`,
    );
  }

  /**
   * Admin credit adjustment (positive or negative).
   */
  async adminAdjust(
    patientId: string,
    amount: number,
    reason: string,
    adminId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const cb = await tx.creditBalance.upsert({
        where: { patientId },
        update: {},
        create: { patientId, balance: 0 },
      });

      const balanceBefore = cb.balance;
      const balanceAfter = balanceBefore + amount;

      if (balanceAfter < 0) {
        throw new BadRequestException(
          `Solde insuffisant: ${balanceBefore} + (${amount}) = ${balanceAfter}`,
        );
      }

      await tx.creditBalance.update({
        where: { patientId },
        data: { balance: balanceAfter },
      });

      const transaction = await tx.creditTransaction.create({
        data: {
          creditBalanceId: cb.id,
          type: CreditTransactionType.ADMIN_ADJUSTMENT,
          amount,
          balanceBefore,
          balanceAfter,
          description: `Ajustement admin: ${reason} (par ${adminId.slice(0, 8)})`,
        },
      });

      this.logger.log(
        `Admin adjustment: patient=${patientId}, amount=${amount}, reason="${reason}", admin=${adminId}`,
      );

      return transaction;
    });
  }

  /**
   * Get paginated transaction history for a patient.
   */
  async getTransactions(patientId: string, page = 1, limit = 20) {
    const cb = await this.ensureBalance(patientId);

    const [transactions, total] = await Promise.all([
      this.prisma.creditTransaction.findMany({
        where: { creditBalanceId: cb.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.creditTransaction.count({
        where: { creditBalanceId: cb.id },
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

  // ─── Private helper ───

  private async deduct(
    patientId: string,
    cost: number,
    type: CreditTransactionType,
    referenceId: string,
    referenceType: string,
    description: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const cb = await tx.creditBalance.findUnique({
        where: { patientId },
      });

      if (!cb || cb.balance < cost) {
        throw new BadRequestException(
          `Credits insuffisants: solde=${cb?.balance ?? 0}, requis=${cost}`,
        );
      }

      const balanceBefore = cb.balance;
      const balanceAfter = balanceBefore - cost;

      await tx.creditBalance.update({
        where: { patientId },
        data: { balance: balanceAfter },
      });

      const transaction = await tx.creditTransaction.create({
        data: {
          creditBalanceId: cb.id,
          type,
          amount: -cost,
          balanceBefore,
          balanceAfter,
          description,
          referenceId,
          referenceType,
        },
      });

      this.logger.log(
        `Credits deducted: patient=${patientId}, cost=-${cost}, balance=${balanceBefore}->${balanceAfter}, ref=${referenceType}:${referenceId.slice(0, 8)}`,
      );

      return transaction;
    });
  }
}
