import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AnnotateExamDto {
  @ApiProperty({
    description: 'Commentaire du medecin sur le resultat',
    example: 'Resultats dans les normes. Continuer le traitement actuel.',
  })
  @IsString({ message: 'Le commentaire doit etre une chaine de caracteres' })
  @IsNotEmpty({ message: 'Le commentaire du medecin est obligatoire' })
  doctorComment: string;
}
