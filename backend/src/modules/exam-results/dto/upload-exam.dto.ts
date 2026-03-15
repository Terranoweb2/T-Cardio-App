import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExamType } from '@prisma/client';

export class UploadExamDto {
  @ApiProperty({
    enum: ExamType,
    description: "Type d'examen medical",
    example: ExamType.BLOOD_TEST,
  })
  @IsEnum(ExamType, { message: "Le type d'examen est invalide" })
  type: ExamType;

  @ApiPropertyOptional({
    description: "Titre de l'examen",
    example: 'Bilan sanguin complet',
  })
  @IsOptional()
  @IsString({ message: 'Le titre doit etre une chaine de caracteres' })
  title?: string;

  @ApiPropertyOptional({
    description: "Notes supplementaires sur l'examen",
    example: 'Examen realise a jeun',
  })
  @IsOptional()
  @IsString({ message: 'Les notes doivent etre une chaine de caracteres' })
  notes?: string;
}
