import { IsInt, IsOptional, IsEnum, IsString, IsDateString, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MeasurementSource, MeasurementContext } from '@prisma/client';

export class CreateMeasurementDto {
  @ApiProperty({ minimum: 50, maximum: 300 }) @IsInt() @Min(50) @Max(300) systolic: number;
  @ApiProperty({ minimum: 30, maximum: 200 }) @IsInt() @Min(30) @Max(200) diastolic: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(30) @Max(250) pulse?: number;
  @ApiPropertyOptional({ enum: MeasurementSource }) @IsOptional() @IsEnum(MeasurementSource) source?: MeasurementSource;
  @ApiPropertyOptional({ enum: MeasurementContext }) @IsOptional() @IsEnum(MeasurementContext) context?: MeasurementContext;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() photoPath?: string;
  @ApiProperty() @IsDateString() measuredAt: string;
}
