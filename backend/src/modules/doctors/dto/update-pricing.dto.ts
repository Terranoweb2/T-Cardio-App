import { IsInt, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdatePricingDto {
  @ApiPropertyOptional({
    description: 'Teleconsultation price in XOF (min 1000)',
    example: 5000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  consultationPriceXof?: number;

  @ApiPropertyOptional({
    description: 'Messaging session price in XOF (0 = free)',
    example: 500,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  messagingPriceXof?: number;

  @ApiPropertyOptional({
    description: 'Emergency call price in XOF (min 0)',
    example: 1000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  emergencyPriceXof?: number;
}
