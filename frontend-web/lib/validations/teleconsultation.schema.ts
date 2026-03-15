import { z } from 'zod';

export const requestTeleconsultationSchema = z.object({
  reason: z
    .string()
    .min(10, 'Decrivez votre motif (minimum 10 caracteres)')
    .max(1000, 'Maximum 1000 caracteres'),
  preferredDate: z
    .string()
    .min(1, 'La date souhaitee est requise')
    .refine((val) => {
      const date = new Date(val);
      return date > new Date();
    }, 'La date doit etre dans le futur'),
  urgency: z.enum(['NORMAL', 'URGENT']).default('NORMAL'),
});

export type RequestTeleconsultationFormData = z.infer<typeof requestTeleconsultationSchema>;

export const chatMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Le message ne peut pas etre vide')
    .max(2000, 'Maximum 2000 caracteres'),
});

export type ChatMessageFormData = z.infer<typeof chatMessageSchema>;
