import { IsArray, IsInt, IsOptional, IsString, IsDateString, Min, Max, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class SyncRecordDto {
  @ApiProperty({ minimum: 50, maximum: 300 })
  @IsInt()
  @Min(50)
  @Max(300)
  systolic: number;

  @ApiProperty({ minimum: 30, maximum: 200 })
  @IsInt()
  @Min(30)
  @Max(200)
  diastolic: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(250)
  pulse?: number;

  @ApiProperty({ description: 'Date de mesure au format ISO' })
  @IsDateString()
  measuredAt: string;

  @ApiPropertyOptional({ description: 'Contexte de la mesure (REPOS, MATIN, SOIR, etc.)' })
  @IsOptional()
  @IsString()
  context?: string;
}

export class SyncDataDto {
  @ApiProperty({ type: [SyncRecordDto], description: 'Liste des mesures a synchroniser' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncRecordDto)
  records: SyncRecordDto[];
}
