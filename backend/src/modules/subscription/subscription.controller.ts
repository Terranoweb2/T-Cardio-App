import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/guards/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { SubscriptionService } from './subscription.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { SubscriptionStatus } from '@prisma/client';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('subscriptions')
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('me')
  @Roles('PATIENT', 'MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Obtenir l\'abonnement actuel' })
  async getMySubscription(@CurrentUser('sub') userId: string, @CurrentUser('role') role: string) {
    if (role === 'MEDECIN' || role === 'CARDIOLOGUE') {
      return { subscription: null, isActive: true };
    }
    const patient = await this.prisma.patient.findUnique({
      where: { userId },
    });
    if (!patient) {
      return { subscription: null, isActive: false };
    }

    const subscription = await this.subscriptionService.getLatestSubscription(patient.id);
    const isActive = await this.subscriptionService.hasActiveSubscription(patient.id);

    return { subscription, isActive };
  }

  @Post('cancel')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Annuler l\'abonnement' })
  async cancel(
    @CurrentUser('sub') userId: string,
    @Body() body: { reason?: string },
  ) {
    const patient = await this.prisma.patient.findUnique({
      where: { userId },
    });
    if (!patient) {
      return { success: false, message: 'Patient non trouve' };
    }

    const cancelled = await this.subscriptionService.cancelSubscription(
      patient.id,
      body.reason,
    );
    return { success: true, subscription: cancelled };
  }

  @Get('admin')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Lister tous les abonnements (admin)' })
  async adminList(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: SubscriptionStatus,
  ) {
    return this.subscriptionService.getAllSubscriptions(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      status,
    );
  }
}
