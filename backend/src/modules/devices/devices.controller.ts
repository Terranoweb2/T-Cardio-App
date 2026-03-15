import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { SyncDataDto } from './dto/sync-data.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/guards/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@ApiTags('Devices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('devices')
export class DevicesController {
  constructor(
    private readonly devicesService: DevicesService,
    private readonly prisma: PrismaService,
  ) {}

  private async getPatientId(userId: string): Promise<string> {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) throw new BadRequestException('Profil patient requis');
    return patient.id;
  }

  @Post()
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Enregistrer un nouvel appareil connecte' })
  async register(
    @CurrentUser('sub') userId: string,
    @Body() dto: RegisterDeviceDto,
  ) {
    const patientId = await this.getPatientId(userId);
    return this.devicesService.register(patientId, dto);
  }

  @Get()
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Lister mes appareils connectes' })
  async getDevices(@CurrentUser('sub') userId: string) {
    const patientId = await this.getPatientId(userId);
    return this.devicesService.getDevices(patientId);
  }

  @Delete(':id')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Deconnecter un appareil' })
  async removeDevice(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    const patientId = await this.getPatientId(userId);
    return this.devicesService.removeDevice(patientId, id);
  }

  @Post(':id/sync')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Synchroniser les donnees d\'un appareil' })
  async syncData(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: SyncDataDto,
  ) {
    const patientId = await this.getPatientId(userId);
    return this.devicesService.syncData(patientId, id, dto);
  }

  @Get(':id/history')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Historique de synchronisation d\'un appareil' })
  async getSyncHistory(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    const patientId = await this.getPatientId(userId);
    return this.devicesService.getSyncHistory(patientId, id);
  }
}
