import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Verify2faDto {
  @ApiProperty({
    description: 'Code TOTP a 6 chiffres genere par l\'application d\'authentification',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @Length(6, 6)
  token: string;
}
