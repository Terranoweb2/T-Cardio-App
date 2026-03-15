import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateGoalProgressDto {
  @ApiProperty({ description: 'Nouvelle valeur de progression', minimum: 0 })
  @IsNumber()
  @Min(0)
  currentValue: number;
}
