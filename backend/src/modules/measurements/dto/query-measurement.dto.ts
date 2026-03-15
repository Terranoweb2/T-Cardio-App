import { IsOptional, IsInt, IsEnum, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class QueryMeasurementDto {
  @ApiPropertyOptional({ default: 30 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365) days?: number = 30;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 20;
}
