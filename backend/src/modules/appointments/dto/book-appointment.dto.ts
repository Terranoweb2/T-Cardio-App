import { IsString, IsOptional, IsDateString, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BookAppointmentDto {
  @ApiProperty({ description: 'ID du medecin' })
  @IsString()
  doctorId: string;

  @ApiProperty({ description: 'Date et heure du rendez-vous (ISO 8601)', example: '2026-03-10T10:00:00.000Z' })
  @IsDateString()
  scheduledAt: string;

  @ApiPropertyOptional({ description: 'Motif du rendez-vous' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: 'Duree en minutes', default: 30, minimum: 10, maximum: 120 })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(120)
  durationMin?: number;
}
