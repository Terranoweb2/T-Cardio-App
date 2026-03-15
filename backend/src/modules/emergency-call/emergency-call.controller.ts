import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { EmergencyCallService } from './emergency-call.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/guards/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { SubscriptionGuard } from '../../core/guards/subscription.guard';

@ApiTags('Emergency Calls')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('emergency-calls')
export class EmergencyCallController {
  constructor(private readonly service: EmergencyCallService) {}

  @Post('trigger')
  @Roles('PATIENT')
  @UseGuards(SubscriptionGuard)
  @ApiOperation({ summary: 'Declencher un appel d\'urgence (avec protection anti-abus)' })
  async triggerEmergency(
    @CurrentUser('sub') userId: string,
    @Body() body: { doctorId: string; emergencyType?: 'free' | 'paid' },
  ) {
    return this.service.triggerEmergencyCall(userId, body.doctorId, body.emergencyType || 'free');
  }

  @Post(':eventId/acknowledge')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Accepter un appel d\'urgence' })
  async acknowledgeEmergency(
    @Param('eventId') eventId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.service.acknowledgeEmergencyCall(eventId, userId);
  }

  @Post(':eventId/refuse')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Refuser un appel d\'urgence (notification renvoyee)' })
  async refuseEmergency(
    @Param('eventId') eventId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.service.refuseEmergencyCall(eventId, userId);
  }

  @Post(':eventId/callback')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Rappeler le patient (urgence payante, 1 seule fois)' })
  async doctorCallback(
    @Param('eventId') eventId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.service.doctorCallback(eventId, userId);
  }

  @Get('cooldown')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Verifier le statut de cooldown' })
  async getCooldownStatus(
    @CurrentUser('sub') userId: string,
    @Query('doctorId') doctorId: string,
  ) {
    return this.service.getCooldownStatus(userId, doctorId);
  }

  @Get('patient')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Historique des appels d\'urgence (patient)' })
  async getPatientEmergencies(@CurrentUser('sub') userId: string) {
    return this.service.getPatientEmergencies(userId);
  }

  @Get('doctor')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Historique des appels d\'urgence (medecin)' })
  async getDoctorEmergencies(@CurrentUser('sub') userId: string) {
    return this.service.getDoctorEmergencies(userId);
  }

  @Get('audit')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Logs IA d\'audit des urgences (admin)' })
  async getAuditLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getAuditLogs(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }

  @Get('audit/abuse')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Alertes d\'abus detectes (admin)' })
  async getAbuseFlags() {
    return this.service.getAbuseFlags();
  }
}
