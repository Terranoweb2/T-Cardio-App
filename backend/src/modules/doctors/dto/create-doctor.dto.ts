import { IsString, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateDoctorDto {
  @ApiProperty() @IsString() firstName: string;
  @ApiProperty() @IsString() lastName: string;
  @ApiPropertyOptional() @IsOptional() @IsString() rppsNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() specialty?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() practiceAddress?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() practicePhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() profilePhotoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) consultationPriceXof?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(5) defaultDurationMinutes?: number;
}
