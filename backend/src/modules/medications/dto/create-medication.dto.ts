import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MedicationFrequency } from '@prisma/client';

export class CreateMedicationDto {
  @ApiProperty({ description: 'Nom du medicament' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Dosage (ex: 500mg)' })
  @IsOptional()
  @IsString()
  dosage?: string;

  @ApiPropertyOptional({
    enum: MedicationFrequency,
    description: 'Frequence de prise',
  })
  @IsOptional()
  @IsEnum(MedicationFrequency)
  frequency?: MedicationFrequency;

  @ApiPropertyOptional({
    type: [String],
    description: 'Heures de rappel (ex: ["08:00", "20:00"])',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  reminderTimes?: string[];

  @ApiProperty({ description: 'Date de debut (ISO 8601)' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ description: 'Date de fin (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Notes supplementaires' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Prescrit par (nom du medecin)' })
  @IsOptional()
  @IsString()
  prescribedBy?: string;
}
