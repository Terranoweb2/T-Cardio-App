import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'L\'email est requis')
    .email('Format d\'email invalide'),
  password: z
    .string()
    .min(1, 'Le mot de passe est requis'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    email: z
      .string()
      .min(1, 'L\'email est requis')
      .email('Format d\'email invalide'),
    password: z
      .string()
      .min(8, 'Le mot de passe doit contenir au moins 8 caracteres')
      .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule')
      .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre'),
    confirmPassword: z
      .string()
      .min(1, 'La confirmation est requise'),
    role: z.enum(['PATIENT', 'MEDECIN', 'CARDIOLOGUE'], {
      required_error: 'Le type de compte est requis',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

export type RegisterFormData = z.infer<typeof registerSchema>;
