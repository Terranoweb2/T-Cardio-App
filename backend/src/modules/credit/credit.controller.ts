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
import { CreditService } from './credit.service';
import { PrismaService } from '../../core/prisma/prisma.service';

@ApiTags('Credits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('credits')
export class CreditController {
  constructor(
    private readonly creditService: CreditService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('balance')
  @Roles('PATIENT', 'MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Obtenir le solde de credits' })
  async getBalance(@CurrentUser('sub') userId: string, @CurrentUser('role') role: string) {
    if (role === 'MEDECIN' || role === 'CARDIOLOGUE') {
      return { balance: 0 };
    }
    const patient = await this.prisma.patient.findUnique({
      where: { userId },
    });
    if (!patient) {
      return { balance: 0 };
    }
    const balance = await this.creditService.getBalance(patient.id);
    return { balance };
  }

  @Get('transactions')
  @Roles('PATIENT', 'MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Historique des transactions de credits' })
  async getTransactions(
    @CurrentUser('sub') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const patient = await this.prisma.patient.findUnique({
      where: { userId },
    });
    if (!patient) {
      return { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
    }
    return this.creditService.getTransactions(
      patient.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Post('admin/adjust')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Ajustement administratif de credits' })
  async adminAdjust(
    @CurrentUser('sub') adminUserId: string,
    @Body() body: { patientId: string; amount: number; reason: string },
  ) {
    const transaction = await this.creditService.adminAdjust(
      body.patientId,
      body.amount,
      body.reason,
      adminUserId,
    );
    return { success: true, transaction };
  }

  @Post('admin/bonus')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Ajouter des credits bonus a un patient' })
  async adminBonus(
    @CurrentUser('sub') adminUserId: string,
    @Body() body: { patientId: string; amount: number; description: string },
  ) {
    const transaction = await this.creditService.addBonus(
      body.patientId,
      body.amount,
      body.description,
    );
    return { success: true, transaction };
  }
}
