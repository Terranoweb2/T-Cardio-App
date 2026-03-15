import { IsEnum, IsString, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeviceType } from '@prisma/client';

export class RegisterDeviceDto {
  @ApiProperty({ enum: DeviceType, description: 'Type d\'appareil' })
  @IsEnum(DeviceType)
  type: DeviceType;

  @ApiProperty({ description: 'Nom de l\'appareil' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Identifiant unique de l\'appareil' })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ description: 'Configuration de synchronisation' })
  @IsOptional()
  @IsObject()
  syncConfig?: Record<string, any>;
}
