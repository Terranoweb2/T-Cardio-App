import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/guards/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { DoctorWalletService } from './doctor-wallet.service';
import { PrismaService } from '../../core/prisma/prisma.service';

@ApiTags('Doctor Wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('doctor-wallet')
export class DoctorWalletController {
  constructor(
    private readonly walletService: DoctorWalletService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('stats')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Statistiques des revenus du medecin' })
  async getStats(@CurrentUser('sub') userId: string) {
    const doctor = await this.prisma.doctor.findUnique({ where: { userId } });
    if (!doctor) {
      return {
        balance: 0,
        todayEarnings: 0,
        weekEarnings: 0,
        monthEarnings: 0,
        totalConsultations: 0,
        totalEmergencies: 0,
      };
    }
    return this.walletService.getStats(doctor.id);
  }

  @Get('transactions')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Historique des transactions du portefeuille' })
  async getTransactions(
    @CurrentUser('sub') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const doctor = await this.prisma.doctor.findUnique({ where: { userId } });
    if (!doctor) {
      return { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
    }
    return this.walletService.getTransactions(
      doctor.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Post('withdraw')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Demander un retrait Mobile Money' })
  async requestWithdrawal(
    @CurrentUser('sub') userId: string,
    @Body() body: { amount: number; mobileMoneyPhone: string; mobileMoneyOperator: string },
  ) {
    const doctor = await this.prisma.doctor.findUnique({ where: { userId } });
    if (!doctor) {
      return { error: 'Profil medecin non trouve' };
    }
    return this.walletService.requestWithdrawal(
      doctor.id,
      body.amount,
      body.mobileMoneyPhone,
      body.mobileMoneyOperator,
    );
  }

  @Get('withdrawals')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Historique des retraits du medecin' })
  async getWithdrawals(
    @CurrentUser('sub') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const doctor = await this.prisma.doctor.findUnique({ where: { userId } });
    if (!doctor) {
      return { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
    }
    return this.walletService.getWithdrawals(
      doctor.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}
