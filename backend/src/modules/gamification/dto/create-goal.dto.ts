import { IsEnum, IsString, IsOptional, IsNumber, IsDateString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GoalType } from '@prisma/client';

export class CreateGoalDto {
  @ApiProperty({ enum: GoalType, description: 'Type d\'objectif de sante' })
  @IsEnum(GoalType)
  type: GoalType;

  @ApiProperty({ description: 'Titre de l\'objectif' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Description detaillee de l\'objectif' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Valeur cible a atteindre', minimum: 0 })
  @IsNumber()
  @Min(0)
  targetValue: number;

  @ApiPropertyOptional({ description: 'Unite de mesure (ex: jours, mmHg, minutes)' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ description: 'Date limite au format ISO 8601' })
  @IsOptional()
  @IsDateString()
  deadline?: string;
}
