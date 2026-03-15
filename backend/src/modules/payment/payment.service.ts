import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreditService } from '../credit/credit.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { PaymentStatus, PaymentType, SubscriptionPlan } from '@prisma/client';
import { InitiatePaymentType } from './dto/initiate-payment.dto';
import { NotFoundException } from '@nestjs/common';

// FedaPay SDK (CommonJS)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const FedaPay = require('fedapay');

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly fedapayConfig: {
    secretKey: string;
    publicKey: string;
    environment: 'sandbox' | 'live';
    callbackUrl: string;
  };
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
  ) {
    this.fedapayConfig = this.configService.get('payment.fedapay')!;
    this.plans = this.configService.get('payment.plans')!;
    this.creditPackages = this.configService.get('payment.creditPackages')!;

    // Configure FedaPay SDK
    FedaPay.FedaPay.setApiKey(this.fedapayConfig.secretKey);
    FedaPay.FedaPay.setEnvironment(this.fedapayConfig.environment);

    this.logger.log(
      `FedaPay initialized: env=${this.fedapayConfig.environment}`,
    );
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
   * Initiate a payment via FedaPay.
   * Creates a local Payment record + FedaPay transaction, returns payment URL.
   */
  async initiatePayment(
    patientId: string,
    type: InitiatePaymentType,
    packageId: string,
    userEmail: string,
    callbackUrl?: string,
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
      description = `Abonnement ${plan.name} - T-Cardio Pro (${amountXof} XOF/an)`;
      paymentType = PaymentType.SUBSCRIPTION;
    } else {
      const pkg = this.creditPackages.find((p) => p.id === packageId);
      if (!pkg) {
        throw new BadRequestException(`Pack credits inconnu: ${packageId}`);
      }
      amountXof = pkg.priceXof;
      description = `Achat credits ${pkg.name} - ${pkg.credits + pkg.bonus} credits`;
      paymentType = PaymentType.CREDIT_PURCHASE;
    }

    // Create local Payment record (PENDING)
    const payment = await this.prisma.payment.create({
      data: {
        patientId,
        type: paymentType,
        amountXof,
        status: PaymentStatus.PENDING,
        description,
        metadata: { packageId, type },
      },
    });

    try {
      // Create FedaPay transaction
      const transaction = await FedaPay.Transaction.create({
        description,
        amount: amountXof,
        currency: { iso: 'XOF' },
        callback_url:
          callbackUrl || this.fedapayConfig.callbackUrl,
        customer: {
          email: userEmail,
        },
        custom_metadata: {
          payment_id: payment.id,
          patient_id: patientId,
          type: paymentType,
          package_id: packageId,
        },
      });

      // Generate payment token/URL
      const token = await transaction.generateToken();

      // Update local payment with FedaPay references
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          fedapayTransactionId: String(transaction.id),
          fedapayPaymentUrl: token.url,
        },
      });

      this.logger.log(
        `Payment initiated: id=${payment.id}, fedapay=${transaction.id}, amount=${amountXof} XOF`,
      );

      return {
        paymentId: payment.id,
        paymentUrl: token.url,
        amount: amountXof,
        description,
      };
    } catch (error) {
      // Mark payment as failed
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          fedapayData: { error: error.message },
        },
      });

      this.logger.error(`FedaPay transaction creation failed: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        'Erreur lors de la creation du paiement. Veuillez reessayer.',
      );
    }
  }

  /**
   * Handle FedaPay webhook callback.
   * Called when payment status changes.
   */
  async handleWebhook(payload: any) {
    this.logger.log(`Webhook received: ${JSON.stringify(payload).slice(0, 200)}`);

    const entity = payload?.entity;
    if (!entity) {
      this.logger.warn('Webhook: no entity in payload');
      return { status: 'ignored' };
    }

    const fedapayId = String(entity.id || entity.klass_id);
    const fedapayStatus = entity.status;
    const customMetadata = entity.custom_metadata || {};

    // Find local payment
    let payment = await this.prisma.payment.findUnique({
      where: { fedapayTransactionId: fedapayId },
    });

    // Fallback: try to find by payment_id in custom_metadata
    if (!payment && customMetadata.payment_id) {
      payment = await this.prisma.payment.findUnique({
        where: { id: customMetadata.payment_id },
      });
    }

    if (!payment) {
      this.logger.warn(`Webhook: payment not found for FedaPay ID ${fedapayId}`);
      return { status: 'payment_not_found' };
    }

    // Already completed — ignore duplicate webhooks
    if (payment.status === PaymentStatus.COMPLETED) {
      this.logger.log(`Webhook: payment ${payment.id} already completed, ignoring`);
      return { status: 'already_completed' };
    }

    // Map FedaPay status to local status
    if (fedapayStatus === 'approved' || fedapayStatus === 'transferred') {
      // Payment successful!
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.COMPLETED,
          completedAt: new Date(),
          fedapayPaymentMethod: entity.mode || entity.payment_method?.mode || null,
          fedapayData: entity,
        },
      });

      // Activate subscription or add credits
      const metadata = (payment.metadata as any) || {};
      const packageId = metadata.packageId || customMetadata.package_id;

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
            `Pack ${pkg.name} (${pkg.credits} + ${pkg.bonus} bonus)`,
          );

          // Add bonus as separate transaction if any
          // Already included in total above — no separate bonus needed
        }
      }

      this.logger.log(
        `Payment completed: id=${payment.id}, type=${payment.type}, amount=${payment.amountXof} XOF`,
      );

      return { status: 'completed' };
    } else if (
      fedapayStatus === 'declined' ||
      fedapayStatus === 'cancelled' ||
      fedapayStatus === 'refunded'
    ) {
      const localStatus =
        fedapayStatus === 'refunded'
          ? PaymentStatus.REFUNDED
          : PaymentStatus.FAILED;

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: localStatus,
          fedapayData: entity,
        },
      });

      this.logger.log(
        `Payment ${fedapayStatus}: id=${payment.id}, fedapay=${fedapayId}`,
      );

      return { status: fedapayStatus };
    }

    return { status: 'pending' };
  }

  /**
   * Verify a payment status by polling FedaPay.
   */
  async verifyPayment(paymentId: string, patientId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, patientId },
    });

    if (!payment) {
      throw new BadRequestException('Paiement non trouve');
    }

    if (payment.status === PaymentStatus.COMPLETED) {
      return { status: 'completed', payment };
    }

    if (!payment.fedapayTransactionId) {
      return { status: payment.status, payment };
    }

    try {
      const transaction = await FedaPay.Transaction.retrieve(
        parseInt(payment.fedapayTransactionId, 10),
      );

      if (
        transaction.status === 'approved' ||
        transaction.status === 'transferred'
      ) {
        // Process as webhook
        await this.handleWebhook({ entity: transaction });

        const updated = await this.prisma.payment.findUnique({
          where: { id: paymentId },
        });
        return { status: 'completed', payment: updated };
      }

      return { status: transaction.status, payment };
    } catch (error) {
      this.logger.warn(`FedaPay verify failed: ${error.message}`);
      return { status: payment.status, payment };
    }
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
   */
  async getPayment(paymentId: string) {
    return this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        subscriptions: true,
        creditTransactions: true,
      },
    });
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
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TC-${ts}-${rand}`;
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
          // Store the complete USSD code for admin — never exposed to patient
          ...(completeUssdCode ? { completeUssdCode } : {}),
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

    // Mark as completed
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    // Activate subscription or add credits
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
          `MoMo - Pack ${pkg.name} (${pkg.credits} + ${pkg.bonus} bonus)`,
        );
      }
    }

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
}
