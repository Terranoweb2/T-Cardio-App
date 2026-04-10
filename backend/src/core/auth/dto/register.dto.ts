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

  @ApiPropertyOptional({ example: 'Jean' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Dupont' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: '+33612345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Cardiologie' })
  @IsOptional()
  @IsString()
  specialty?: string;
}
