import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFamilyDto {
  @ApiProperty({ description: 'Nom du groupe familial', example: 'Famille Dupont' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom du groupe familial est requis' })
  @MinLength(2, { message: 'Le nom doit contenir au moins 2 caracteres' })
  @MaxLength(100, { message: 'Le nom ne doit pas depasser 100 caracteres' })
  name: string;
}
