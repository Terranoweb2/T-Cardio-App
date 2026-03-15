import { IsOptional, IsNumber, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateTokenDto {
  @ApiPropertyOptional({ description: 'Durée de validité en heures (défaut: 48h)', default: 48 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(720) // 30 days max
  expiresInHours?: number;
}
