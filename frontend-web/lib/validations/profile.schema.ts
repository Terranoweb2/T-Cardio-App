import { z } from 'zod';

export const patientProfileSchema = z.object({
  firstName: z
    .string()
    .min(1, 'Le prenom est requis')
    .max(100, 'Maximum 100 caracteres'),
  lastName: z
    .string()
    .min(1, 'Le nom est requis')
    .max(100, 'Maximum 100 caracteres'),
  birthDate: z
    .string()
    .optional()
    .or(z.literal('')),
  gender: z
    .enum(['MALE', 'FEMALE', 'OTHER'])
    .optional()
    .or(z.literal('')),
  weightKg: z
    .union([
      z.number().min(20, 'Minimum 20 kg').max(300, 'Maximum 300 kg'),
      z.string().transform((val) => {
        if (!val || val === '') return undefined;
        const n = parseFloat(val);
        if (isNaN(n)) return undefined;
        return n;
      }),
    ])
    .optional(),
  heightCm: z
    .union([
      z.number().int().min(50, 'Minimum 50 cm').max(250, 'Maximum 250 cm'),
      z.string().transform((val) => {
        if (!val || val === '') return undefined;
        const n = parseInt(val, 10);
        if (isNaN(n)) return undefined;
        return n;
      }),
    ])
    .optional(),
  medicalStatus: z
    .enum(['STANDARD', 'HYPERTENDU', 'POST_AVC', 'DIABETIQUE', 'AUTRE'])
    .optional()
    .or(z.literal('')),
  emergencyContactName: z
    .string()
    .max(200, 'Maximum 200 caracteres')
    .optional(),
  emergencyContactPhone: z
    .string()
    .max(20, 'Maximum 20 caracteres')
    .regex(/^[\d\s+()-]*$/, 'Format de telephone invalide')
    .optional()
    .or(z.literal('')),
});

export type PatientProfileFormData = z.infer<typeof patientProfileSchema>;
