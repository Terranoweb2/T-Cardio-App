import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InviteMemberDto {
  @ApiProperty({ description: 'Email du membre a inviter', example: 'membre@example.com' })
  @IsEmail({}, { message: 'Adresse email invalide' })
  @IsNotEmpty({ message: "L'adresse email est requise" })
  email: string;
}
