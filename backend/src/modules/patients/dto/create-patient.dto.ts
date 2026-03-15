import { IsString, IsOptional, IsEnum, IsInt, IsNumber, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, MedicalStatus } from '@prisma/client';

export class CreatePatientDto {
  @ApiProperty() @IsString() firstName: string;
  @ApiProperty() @IsString() lastName: string;
  @ApiProperty() @IsDateString() birthDate: string;
  @ApiPropertyOptional({ enum: Gender }) @IsOptional() @IsEnum(Gender) gender?: Gender;
  @ApiPropertyOptional() @IsOptional() @IsInt() heightCm?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() weightKg?: number;
  @ApiPropertyOptional({ enum: MedicalStatus }) @IsOptional() @IsEnum(MedicalStatus) medicalStatus?: MedicalStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() emergencyContactName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() emergencyContactPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() profilePhotoUrl?: string;
}
