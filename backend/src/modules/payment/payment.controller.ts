import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  HttpCode,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/guards/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { PaymentService } from './payment.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { PaymentStatus, PaymentType } from '@prisma/client';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Public Endpoints ───

  @Get('packages')
  @ApiOperation({ summary: 'Liste des packs credits disponibles' })
  getPackages() {
    return this.paymentService.getCreditPackages();
  }

  @Get('plans')
  @ApiOperation({ summary: 'Liste des plans abonnement disponibles' })
  getPlans() {
    return this.paymentService.getPlans();
  }

  // ─── Authenticated Patient Endpoints ───

  @Get('history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Historique des paiements du patient' })
  async getHistory(
    @CurrentUser('sub') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const patient = await this.prisma.patient.findUnique({
      where: { userId },
    });

    if (!patient) {
      return {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };
    }

    return this.paymentService.getPaymentHistory(
      patient.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  // ─── MoMo Local Payment Endpoints (MUST be before :id routes) ───

  @Get('momo/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Paiements MoMo en attente de validation' })
  async getMomoPending(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.paymentService.adminGetPendingMomoPayments(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Post('momo/initiate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initier un paiement MoMo local (USSD)' })
  async initiateMomo(
    @CurrentUser('sub') userId: string,
    @Body() dto: InitiatePaymentDto,
  ) {
    const patient = await this.prisma.patient.findUnique({
      where: { userId },
    });

    if (!patient) {
      return { success: false, message: 'Profil patient non trouve' };
    }

    const result = await this.paymentService.initiateMomoPayment(
      patient.id,
      dto.type,
      dto.packageId,
    );

    return { success: true, ...result };
  }

  // ─── MTN MoMo Collections API (automatic confirmation) ───

  @Get('momo/config')
  @ApiOperation({ summary: 'Indique si le paiement MoMo automatique (API MTN) est actif' })
  getMomoConfig() {
    return { apiEnabled: this.paymentService.isMtnApiEnabled() };
  }

  @Post('momo/request-to-pay')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initier un paiement via l\'API MTN MoMo (Request to Pay)' })
  async requestToPay(
    @CurrentUser('sub') userId: string,
    @Body() dto: InitiatePaymentDto,
  ) {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) {
      return { success: false, message: 'Profil patient non trouve' };
    }

    const result = await this.paymentService.requestToPay(
      patient.id,
      dto.type,
      dto.packageId,
      dto.msisdn ?? '',
    );

    return { success: true, ...result };
  }

  @Post('momo/callback')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Callback MTN MoMo (resultat de transaction, re-verifie)' })
  async momoCallback(@Body() body: any) {
    // The callback is unsigned: never trust the body, never leak whether a
    // payment exists. Processing (re-verification) happens server-side; we
    // always return a generic ack so this endpoint is not an existence oracle.
    await this.paymentService.handleMomoApiCallback(body).catch(() => undefined);
    return { received: true };
  }

  @Post('momo/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verifier/finaliser le statut d\'un paiement MoMo API' })
  async checkMomoStatus(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) {
      return { status: 'error', message: 'Patient non trouve' };
    }
    return this.paymentService.checkMomoApiPaymentStatus(id, patient.id);
  }

  @Post('momo/:id/declare-paid')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Declarer un paiement MoMo comme effectue' })
  async declareMomoPaid(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() body: { pin?: string },
  ) {
    const patient = await this.prisma.patient.findUnique({
      where: { userId },
    });

    if (!patient) {
      return { success: false, message: 'Patient non trouve' };
    }

    return this.paymentService.declareMomoPaid(id, patient.id, body?.pin);
  }

  @Post('momo/:id/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Confirmer un paiement MoMo' })
  async confirmMomo(@Param('id') id: string) {
    return this.paymentService.adminConfirmMomoPayment(id);
  }

  @Post('momo/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Rejeter un paiement MoMo' })
  async rejectMomo(@Param('id') id: string) {
    return this.paymentService.adminRejectMomoPayment(id);
  }

  // ─── Admin Endpoints (MUST be before :id routes) ───

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tous les paiements (admin)' })
  async adminGetPayments(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: PaymentStatus,
    @Query('type') type?: PaymentType,
  ) {
    return this.paymentService.adminGetPayments(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      status,
      type,
    );
  }

  // ─── Dynamic :id routes (MUST be last) ───

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Details d\'un paiement' })
  async getPayment(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: string,
  ) {
    // Admins can read any payment; patients only their own (prevents IDOR).
    if (role === 'ADMIN') {
      return this.paymentService.getPayment(id);
    }
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) {
      throw new NotFoundException('Paiement non trouve');
    }
    return this.paymentService.getPayment(id, patient.id);
  }
}
