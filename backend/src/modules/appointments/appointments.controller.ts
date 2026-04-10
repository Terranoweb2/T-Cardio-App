import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import { BookAppointmentDto } from './dto/book-appointment.dto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/guards/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AppointmentStatus } from '@prisma/client';

@ApiTags('Appointments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly prisma: PrismaService,
  ) {}

  // ==================== BOOK (PATIENT) ====================

  @Post('book')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Prendre un rendez-vous avec un medecin' })
  async book(@CurrentUser('sub') userId: string, @Body() dto: BookAppointmentDto) {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) {
      throw new BadRequestException('Profil patient non trouve');
    }
    return this.appointmentsService.book(patient.id, dto);
  }

  // ==================== MY APPOINTMENTS (PATIENT) ====================

  @Get('mine')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Mes rendez-vous (patient)' })
  @ApiQuery({ name: 'status', required: false, enum: AppointmentStatus })
  async getMyAppointments(
    @CurrentUser('sub') userId: string,
    @Query('status') status?: AppointmentStatus,
  ) {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) {
      throw new BadRequestException('Profil patient non trouve');
    }
    return this.appointmentsService.getPatientAppointments(patient.id, status);
  }

  // ==================== DOCTOR APPOINTMENTS ====================

  @Get('doctor')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Rendez-vous du medecin' })
  @ApiQuery({ name: 'status', required: false, enum: AppointmentStatus })
  async getDoctorAppointments(
    @CurrentUser('sub') userId: string,
    @Query('status') status?: AppointmentStatus,
  ) {
    return this.appointmentsService.getDoctorAppointments(userId, status);
  }

  // ==================== CONFIRM (DOCTOR) ====================

  @Patch(':id/confirm')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Confirmer un rendez-vous' })
  async confirm(
    @CurrentUser('sub') userId: string,
    @Param('id') appointmentId: string,
  ) {
    return this.appointmentsService.confirm(userId, appointmentId);
  }

  // ==================== REJECT (DOCTOR) ====================

  @Patch(':id/reject')
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Refuser un rendez-vous' })
  async reject(
    @CurrentUser('sub') userId: string,
    @Param('id') appointmentId: string,
    @Body() body: { reason?: string },
  ) {
    return this.appointmentsService.reject(userId, appointmentId, body?.reason);
  }

  // ==================== CANCEL (PATIENT OR DOCTOR) ====================

  @Patch(':id/cancel')
  @Roles('PATIENT', 'MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Annuler un rendez-vous' })
  async cancel(
    @CurrentUser('sub') userId: string,
    @Param('id') appointmentId: string,
    @Body() body: { reason?: string },
  ) {
    return this.appointmentsService.cancel(userId, appointmentId, body?.reason);
  }

  // ==================== DELETE (PATIENT OR DOCTOR) ====================

  @Delete(':id')
  @Roles('PATIENT', 'MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Supprimer un rendez-vous (passe/annule/refuse)' })
  async remove(
    @CurrentUser('sub') userId: string,
    @Param('id') appointmentId: string,
  ) {
    return this.appointmentsService.delete(userId, appointmentId);
  }
}
