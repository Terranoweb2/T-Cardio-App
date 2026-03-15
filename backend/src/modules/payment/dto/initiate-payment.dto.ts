import { IsEnum, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum InitiatePaymentType {
  SUBSCRIPTION = 'SUBSCRIPTION',
  CREDIT_PURCHASE = 'CREDIT_PURCHASE',
}

export class InitiatePaymentDto {
  @ApiProperty({ enum: InitiatePaymentType, description: 'Type de paiement' })
  @IsEnum(InitiatePaymentType)
  type: InitiatePaymentType;

  @ApiProperty({
    description: 'ID du pack credits (essentiel, standard, premium, mega) ou du plan (BASIC, PRO)',
  })
  @IsString()
  packageId: string;

  @ApiProperty({ required: false, description: 'URL de callback apres paiement' })
  @IsOptional()
  @IsString()
  callbackUrl?: string;
}
