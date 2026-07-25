import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreditService } from '../credit/credit.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { PaymentStatus, PaymentType, SubscriptionPlan, Payment } from '@prisma/client';
import { InitiatePaymentType } from './dto/initiate-payment.dto';
import { MtnMomoService } from './mtn-momo.service';

/**
 * Payment service — local Mobile Money (MoMo) flow only.
 *
 * Payment is handled entirely in-house: the patient dials a USSD code, declares
 * the payment, and an admin confirms reception from the dashboard. There is NO
 * external payment gateway and therefore NO public webhook (which removes the
 * forged-callback attack surface entirely).
 *
 * NOTE: the `fedapayPaymentMethod` Payment column is reused as the channel
 * discriminator (value 'MOMO_LOCAL'). The column keeps its legacy name to avoid
 * a DB migration; it no longer relates to any external provider.
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly plans: Record<string, { priceXof: number; durationDays: number; name: string }>;
  private readonly creditPackages: Array<{
    id: string;
    name: string;
    priceXof: number;
    credits: number;
    bonus: number;
  }>;
  private readonly momoReceiverNumber = '0197548441';

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly creditService: CreditService,
    private readonly subscriptionService: SubscriptionService,
    private readonly mtnMomo: MtnMomoService,
  ) {
    this.plans = this.configService.get('payment.plans')!;
    this.creditPackages = this.configService.get('payment.creditPackages')!;
  }

  /**
   * Resolve the amount / description / payment type for a product selection.
   * Shared by every payment-initiation path (USSD and MTN API).
   */
  private resolveProduct(type: InitiatePaymentType, packageId: string) {
    if (type === InitiatePaymentType.SUBSCRIPTION) {
      const plan = this.plans[packageId];
      if (!plan) throw new BadRequestException(`Plan inconnu: ${packageId}`);
      return {
        amountXof: plan.priceXof,
        description: `Abonnement ${plan.name} (${plan.priceXof} XOF/an)`,
        paymentType: PaymentType.SUBSCRIPTION,
      };
    }
    const pkg = this.creditPackages.find((p) => p.id === packageId);
    if (!pkg) throw new BadRequestException(`Pack credits inconnu: ${packageId}`);
    return {
      amountXof: pkg.priceXof,
      description: `Pack ${pkg.name} (${pkg.credits + pkg.bonus} credits)`,
      paymentType: PaymentType.CREDIT_PURCHASE,
    };
  }

  /**
   * Grant the value of a payment exactly once: activate the subscription or add
   * the purchased credits. Caller MUST have already flipped the payment to
   * COMPLETED atomically so this runs a single time.
   */
  private async applyGrantedValue(payment: Payment, creditLabelPrefix = ''): Promise<void> {
    const metadata = (payment.metadata as any) || {};
    const packageId = metadata.packageId;

    if (payment.type === PaymentType.SUBSCRIPTION) {
      const plan = (packageId as string)?.toUpperCase() as SubscriptionPlan;
      const planConfig = this.plans[plan];
      if (planConfig) {
        await this.subscriptionService.activateSubscription(
          payment.patientId,
          plan,
          payment.id,
          planConfig.priceXof,
        );
      }
    } else if (payment.type === PaymentType.CREDIT_PURCHASE) {
      const pkg = this.creditPackages.find((p) => p.id === packageId);
      if (pkg) {
        const totalCredits = pkg.credits + pkg.bonus;
        await this.creditService.addCredits(
          payment.patientId,
          totalCredits,
          payment.id,
          `${creditLabelPrefix}Pack ${pkg.name} (${pkg.credits} + ${pkg.bonus} bonus)`,
        );
      }
    }
  }

  /**
   * Get available subscription plans.
   */
  getPlans() {
    return Object.entries(this.plans).map(([key, plan]) => ({
      id: key,
      ...plan,
    }));
  }

  /**
   * Get available credit packages.
   */
  getCreditPackages() {
    return this.creditPackages;
  }

  /**
   * Get paginated payment history for a patient.
   */
  async getPaymentHistory(patientId: string, page = 1, limit = 20) {
    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.count({ where: { patientId } }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get a single payment by ID.
   *
   * When `requesterPatientId` is provided (non-admin caller), the payment is
   * only returned if it belongs to that patient — otherwise we behave as if it
   * does not exist (prevents IDOR / cross-patient disclosure).
   */
  async getPayment(paymentId: string, requesterPatientId?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        subscriptions: true,
        creditTransactions: true,
      },
    });

    if (
      requesterPatientId &&
      payment &&
      payment.patientId !== requesterPatientId
    ) {
      throw new NotFoundException('Paiement non trouve');
    }

    return payment;
  }

  /**
   * Admin: Get all payments with filters.
   */
  async adminGetPayments(
    page = 1,
    limit = 20,
    status?: PaymentStatus,
    type?: PaymentType,
  ) {
    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          patient: {
            select: {
              firstName: true,
              lastName: true,
              user: { select: { email: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    // Stats
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [monthlyRevenue, activeSubscriptions, totalTransactions] =
      await Promise.all([
        this.prisma.payment.aggregate({
          where: {
            status: PaymentStatus.COMPLETED,
            completedAt: { gte: monthStart },
          },
          _sum: { amountXof: true },
        }),
        this.prisma.subscription.count({
          where: { status: 'ACTIVE' },
        }),
        this.prisma.payment.count({
          where: {
            status: PaymentStatus.COMPLETED,
            completedAt: { gte: monthStart },
          },
        }),
      ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: {
        monthlyRevenue: monthlyRevenue._sum.amountXof || 0,
        activeSubscriptions,
        totalTransactions,
      },
    };
  }

  // ─── MoMo Local Payment Methods ───

  /**
   * Generate a unique reference for MoMo payments.
   */
  private generateMomoReference(): string {
    // Unguessable, collision-free reference (admin matches it against the MoMo
    // transfer). Uses crypto UUID rather than Math.random + timestamp.
    const hex = randomUUID().replace(/-/g, '');
    return `TC-${hex.slice(0, 6).toUpperCase()}-${hex.slice(6, 10).toUpperCase()}`;
  }

  /**
   * Initiate a MoMo local payment.
   * Creates a PENDING payment and returns the USSD code to dial.
   */
  async initiateMomoPayment(
    patientId: string,
    type: InitiatePaymentType,
    packageId: string,
  ) {
    let amountXof: number;
    let description: string;
    let paymentType: PaymentType;

    if (type === InitiatePaymentType.SUBSCRIPTION) {
      const plan = this.plans[packageId];
      if (!plan) {
        throw new BadRequestException(`Plan inconnu: ${packageId}`);
      }
      amountXof = plan.priceXof;
      description = `MoMo - Abonnement ${plan.name} (${amountXof} XOF)`;
      paymentType = PaymentType.SUBSCRIPTION;
    } else {
      const pkg = this.creditPackages.find((p) => p.id === packageId);
      if (!pkg) {
        throw new BadRequestException(`Pack credits inconnu: ${packageId}`);
      }
      amountXof = pkg.priceXof;
      description = `MoMo - Pack ${pkg.name} (${pkg.credits + pkg.bonus} credits)`;
      paymentType = PaymentType.CREDIT_PURCHASE;
    }

    const reference = this.generateMomoReference();

    // USSD template stored server-side only (PIN placeholder for admin reference)
    const ussdTemplate = `*880*1*1*${this.momoReceiverNumber}*${this.momoReceiverNumber}*${amountXof}*${reference}*PIN#`;

    // Create local Payment record
    const payment = await this.prisma.payment.create({
      data: {
        patientId,
        type: paymentType,
        amountXof,
        status: PaymentStatus.PENDING,
        description,
        // Channel discriminator (legacy column name, see class doc)
        fedapayPaymentMethod: 'MOMO_LOCAL',
        metadata: {
          packageId,
          type,
          momoReference: reference,
          channel: 'MOMO_LOCAL',
          ussdTemplate,
        },
      },
    });

    this.logger.log(
      `MoMo payment initiated: id=${payment.id}, ref=${reference}, amount=${amountXof} XOF`,
    );

    // NOTE: ussdCode is NOT returned to the client — patient must never see it
    return {
      paymentId: payment.id,
      reference,
      amount: amountXof,
      description,
    };
  }

  /**
   * Mark MoMo payment as "declared paid" by patient.
   * Accepts the patient's MoMo PIN, builds the complete USSD code server-side,
   * and stores it in metadata for admin reference. The patient never sees the full code.
   */
  async declareMomoPaid(paymentId: string, patientId: string, pin?: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, patientId, status: PaymentStatus.PENDING },
    });

    if (!payment) {
      throw new BadRequestException('Paiement non trouve ou deja traite');
    }

    const metadata = (payment.metadata as any) || {};
    if (metadata.channel !== 'MOMO_LOCAL') {
      throw new BadRequestException('Ce paiement n\'est pas un paiement MoMo');
    }

    // Build the complete USSD code with the real PIN (server-side only)
    let completeUssdCode: string | null = null;
    if (pin && metadata.momoReference) {
      completeUssdCode = `*880*1*1*${this.momoReceiverNumber}*${this.momoReceiverNumber}*${payment.amountXof}*${metadata.momoReference}*${pin}#`;
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        metadata: {
          ...metadata,
          declaredPaidAt: new Date().toISOString(),
          // SECURITY: the PIN / full USSD code is NEVER persisted. It is returned
          // in the HTTP response below for the native dialer, then discarded.
        },
      },
    });

    this.logger.log(`MoMo payment declared paid by patient: id=${payment.id}`);

    // Return the complete USSD code so the native app (Capacitor SilentCall plugin)
    // can dial it silently — this is never displayed to the patient on screen
    return {
      status: 'declared',
      paymentId: payment.id,
      ...(completeUssdCode ? { ussdCode: completeUssdCode } : {}),
    };
  }

  /**
   * Admin: Confirm a MoMo local payment.
   * Activates subscription or adds credits.
   */
  async adminConfirmMomoPayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Paiement non trouve');
    }

    if (payment.status === PaymentStatus.COMPLETED) {
      throw new BadRequestException('Ce paiement est deja confirme');
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Seuls les paiements en attente peuvent etre confirmes');
    }

    // Atomically claim the completion so a double-click / concurrent confirm
    // can never credit the patient twice.
    const claimed = await this.prisma.payment.updateMany({
      where: { id: payment.id, status: PaymentStatus.PENDING },
      data: {
        status: PaymentStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    if (claimed.count === 0) {
      throw new BadRequestException('Ce paiement vient d\'etre traite');
    }

    // Grant from the authoritative just-claimed row, not the pre-claim snapshot.
    const confirmed = await this.prisma.payment.findUnique({
      where: { id: payment.id },
    });
    await this.applyGrantedValue(confirmed ?? payment, 'MoMo - ');

    this.logger.log(
      `MoMo payment confirmed by admin: id=${payment.id}, type=${payment.type}, amount=${payment.amountXof} XOF`,
    );

    return { status: 'confirmed', paymentId: payment.id };
  }

  /**
   * Admin: Reject a MoMo local payment.
   */
  async adminRejectMomoPayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Paiement non trouve');
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Seuls les paiements en attente peuvent etre rejetes');
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED,
      },
    });

    this.logger.log(`MoMo payment rejected by admin: id=${payment.id}`);

    return { status: 'rejected', paymentId: payment.id };
  }

  /**
   * Admin: Get pending MoMo payments for validation.
   */
  async adminGetPendingMomoPayments(page = 1, limit = 20) {
    const where = {
      status: PaymentStatus.PENDING,
      fedapayPaymentMethod: 'MOMO_LOCAL',
    };

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          patient: {
            select: {
              firstName: true,
              lastName: true,
              user: { select: { email: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── MTN MoMo Collections API (automatic confirmation) ───

  /**
   * Whether the live MTN MoMo API is configured. When false, callers should
   * use the manual USSD flow (initiateMomoPayment) instead.
   */
  isMtnApiEnabled(): boolean {
    return this.mtnMomo.isEnabled();
  }

  /**
   * Initiate a payment via the MTN MoMo Collections API (Request to Pay).
   * MTN pushes a PIN prompt to the payer's phone; confirmation arrives later
   * via callback and/or status polling — no admin action required.
   */
  async requestToPay(
    patientId: string,
    type: InitiatePaymentType,
    packageId: string,
    msisdn: string,
  ) {
    if (!this.mtnMomo.isEnabled()) {
      throw new BadRequestException(
        'Le paiement MoMo automatique n\'est pas disponible pour le moment.',
      );
    }
    const normalizedMsisdn = this.mtnMomo.normalizeMsisdn(msisdn || '');
    if (normalizedMsisdn.length < 11 || normalizedMsisdn.length > 15) {
      throw new BadRequestException('Numero de telephone invalide.');
    }

    const { amountXof, description, paymentType } = this.resolveProduct(
      type,
      packageId,
    );

    // X-Reference-Id (MTN transaction id) — stored in the unique
    // fedapayTransactionId column (legacy name, reused as external txn id).
    const referenceId = randomUUID();

    const payment = await this.prisma.payment.create({
      data: {
        patientId,
        type: paymentType,
        amountXof,
        status: PaymentStatus.PENDING,
        description: `MTN MoMo - ${description}`,
        fedapayPaymentMethod: 'MTN_MOMO_API',
        fedapayTransactionId: referenceId,
        metadata: {
          packageId,
          type,
          channel: 'MTN_MOMO_API',
          msisdn: normalizedMsisdn,
        },
      },
    });

    try {
      await this.mtnMomo.requestToPay({
        referenceId,
        amount: amountXof,
        externalId: payment.id,
        msisdn,
        payerMessage: description,
        payeeNote: 'T-Cardio Pro',
      });
    } catch (error) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          fedapayData: { error: (error as Error).message },
        },
      });
      this.logger.error(
        `MoMo requestToPay failed: payment=${payment.id} — ${(error as Error).message}`,
      );
      throw new BadRequestException(
        'Echec de la demande de paiement. Verifiez votre numero et reessayez.',
      );
    }

    this.logger.log(
      `MoMo API payment initiated: id=${payment.id}, ref=${referenceId}, amount=${amountXof}`,
    );

    return {
      paymentId: payment.id,
      referenceId,
      amount: amountXof,
      status: 'PENDING',
      message: 'Demande envoyee. Validez le paiement sur votre telephone (code PIN MoMo).',
    };
  }

  /**
   * Poll the MTN API for a payment's outcome and finalize it if resolved.
   * Safe to call repeatedly from the client while waiting for the payer to
   * approve on their phone.
   */
  async checkMomoApiPaymentStatus(paymentId: string, patientId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, patientId },
    });

    if (!payment) {
      throw new BadRequestException('Paiement non trouve');
    }
    if (payment.status === PaymentStatus.COMPLETED) {
      return { status: 'completed', paymentId: payment.id };
    }
    if (payment.status === PaymentStatus.FAILED) {
      return { status: 'failed', paymentId: payment.id };
    }
    if (!payment.fedapayTransactionId) {
      throw new BadRequestException('Reference MoMo manquante');
    }

    const result = await this.mtnMomo.getTransactionStatus(
      payment.fedapayTransactionId,
    );
    return this.finalizeFromMtnStatus(payment, result);
  }

  /**
   * Handle an MTN callback. The callback is NOT cryptographically signed, so
   * the body is NEVER trusted: we look the payment up by our own externalId and
   * RE-VERIFY the outcome with an authenticated status call before granting value.
   */
  async handleMomoApiCallback(body: any) {
    // Validate identifiers as UUIDs before any DB / MTN work — stops an
    // unauthenticated caller from driving lookups/outbound calls with junk.
    const isUuid = (s: any): s is string =>
      typeof s === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

    const externalId = isUuid(body?.externalId) ? body.externalId : undefined; // = our payment.id
    const referenceId = isUuid(body?.referenceId)
      ? body.referenceId
      : isUuid(body?.X_Reference_Id)
        ? body.X_Reference_Id
        : undefined;

    if (!externalId && !referenceId) {
      this.logger.warn('MoMo callback: no valid identifier in payload');
      return { status: 'ignored' };
    }

    let payment = externalId
      ? await this.prisma.payment.findUnique({ where: { id: externalId } })
      : null;
    if (!payment && referenceId) {
      payment = await this.prisma.payment.findUnique({
        where: { fedapayTransactionId: referenceId },
      });
    }

    if (!payment) {
      this.logger.warn('MoMo callback: payment not found');
      return { status: 'not_found' };
    }
    if (payment.status === PaymentStatus.COMPLETED) {
      return { status: 'already_completed' };
    }
    if (!payment.fedapayTransactionId) {
      return { status: 'no_reference' };
    }

    // Re-verify authoritatively — do not trust the callback payload.
    const result = await this.mtnMomo.getTransactionStatus(
      payment.fedapayTransactionId,
    );
    return this.finalizeFromMtnStatus(payment, result);
  }

  /**
   * Apply an MTN transaction status to a local payment, granting value exactly
   * once on success via an atomic claim.
   */
  private async finalizeFromMtnStatus(
    payment: Payment,
    result: { status: string; financialTransactionId?: string; reason?: string },
  ) {
    if (result.status === 'SUCCESSFUL') {
      const claimed = await this.prisma.payment.updateMany({
        where: { id: payment.id, status: { not: PaymentStatus.COMPLETED } },
        data: {
          status: PaymentStatus.COMPLETED,
          completedAt: new Date(),
          fedapayData: result as any,
        },
      });

      if (claimed.count === 0) {
        return { status: 'completed', paymentId: payment.id };
      }

      // Grant from the authoritative just-claimed row, not the pre-claim snapshot.
      const claimedPayment = await this.prisma.payment.findUnique({
        where: { id: payment.id },
      });
      await this.applyGrantedValue(claimedPayment ?? payment, 'MTN MoMo - ');
      this.logger.log(
        `MoMo API payment completed: id=${payment.id}, fin_txn=${result.financialTransactionId}`,
      );
      return { status: 'completed', paymentId: payment.id };
    }

    if (result.status === 'FAILED') {
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.FAILED, fedapayData: result as any },
      });
      this.logger.log(
        `MoMo API payment failed: id=${payment.id}, reason=${result.reason}`,
      );
      return { status: 'failed', paymentId: payment.id, reason: result.reason };
    }

    return { status: 'pending', paymentId: payment.id };
  }
}
