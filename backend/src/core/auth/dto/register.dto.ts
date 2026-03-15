import { IsEmail, IsString, MinLength, IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'patient@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ enum: ['PATIENT', 'MEDECIN', 'CARDIOLOGUE'] })
  @IsOptional()
  @IsIn(['PATIENT', 'MEDECIN', 'CARDIOLOGUE'], { message: 'Role must be PATIENT, MEDECIN, or CARDIOLOGUE' })
  role?: 'PATIENT' | 'MEDECIN' | 'CARDIOLOGUE';
}
