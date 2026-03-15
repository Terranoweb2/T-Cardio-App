import { IsString, IsEnum, IsDateString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MedicationLogStatus } from '@prisma/client';

export class LogMedicationDto {
  @ApiProperty({ description: 'ID du medicament' })
  @IsString()
  medicationId: string;

  @ApiProperty({
    enum: MedicationLogStatus,
    description: 'Statut de la prise (TAKEN, SKIPPED, MISSED)',
  })
  @IsEnum(MedicationLogStatus)
  status: MedicationLogStatus;

  @ApiProperty({ description: 'Heure prevue de la prise (ISO 8601)' })
  @IsDateString()
  scheduledAt: string;

  @ApiPropertyOptional({ description: 'Notes supplementaires' })
  @IsOptional()
  @IsString()
  notes?: string;
}
