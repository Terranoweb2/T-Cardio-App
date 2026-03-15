import { z } from 'zod';

export const createMeasurementSchema = z.object({
  systolic: z
    .number({ required_error: 'La systolique est requise', invalid_type_error: 'Valeur numerique attendue' })
    .int('Nombre entier requis')
    .min(50, 'Minimum 50 mmHg')
    .max(300, 'Maximum 300 mmHg'),
  diastolic: z
    .number({ required_error: 'La diastolique est requise', invalid_type_error: 'Valeur numerique attendue' })
    .int('Nombre entier requis')
    .min(30, 'Minimum 30 mmHg')
    .max(200, 'Maximum 200 mmHg'),
  pulse: z
    .number({ invalid_type_error: 'Valeur numerique attendue' })
    .int('Nombre entier requis')
    .min(30, 'Minimum 30 bpm')
    .max(250, 'Maximum 250 bpm')
    .optional()
    .or(z.literal('')),
  context: z.enum(['INCONNU', 'REPOS', 'MATIN', 'SOIR', 'APRES_EFFORT', 'STRESS']).default('INCONNU'),
  notes: z.string().max(500, 'Maximum 500 caracteres').optional(),
  source: z.enum(['MANUEL', 'BLUETOOTH', 'PHOTO']).optional(),
  photoPath: z.string().optional(),
});

// Refined schema with cross-field validation
export const measurementSchema = createMeasurementSchema.refine(
  (data) => data.diastolic < data.systolic,
  {
    message: 'La diastolique doit etre inferieure a la systolique',
    path: ['diastolic'],
  }
);

export type CreateMeasurementFormData = z.infer<typeof createMeasurementSchema>;
