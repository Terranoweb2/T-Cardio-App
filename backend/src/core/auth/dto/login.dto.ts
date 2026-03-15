import { IsEmail, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'patient@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  password: string;

  @ApiPropertyOptional({ description: 'Code 2FA si active' })
  @IsOptional()
  @IsString()
  twoFactorCode?: string;
}
