/**
 * Utility to resolve the correct display label for a doctor
 * based on their user role (MEDECIN vs CARDIOLOGUE).
 *
 * T-Cardio has two doctor types:
 *  - MEDECIN       -> "Medecin" (general practitioner)
 *  - CARDIOLOGUE   -> "Cardiologue" (cardiologist)
 */

export type DoctorRole = 'MEDECIN' | 'CARDIOLOGUE';

/**
 * Returns "Cardiologue" or "Medecin" depending on the doctor's role.
 * Falls back to specialty string detection if role is unavailable.
 */
export function getDoctorLabel(
  role?: string | null,
  specialty?: string | null,
): string {
  if (role === 'CARDIOLOGUE') return 'Cardiologue';
  if (role === 'MEDECIN') return 'Medecin';
  // Fallback: try to infer from specialty string
  if (specialty?.toLowerCase().includes('cardio')) return 'Cardiologue';
  return 'Medecin';
}

/**
 * Returns "Mon Cardiologue" or "Mon Medecin" for possessive context.
 */
export function getMyDoctorLabel(
  role?: string | null,
  specialty?: string | null,
): string {
  return `Mon ${getDoctorLabel(role, specialty)}`;
}

/**
 * Returns "votre cardiologue" or "votre medecin" (lowercase, for mid-sentence).
 */
export function getYourDoctorLabel(
  role?: string | null,
  specialty?: string | null,
): string {
  const label = getDoctorLabel(role, specialty);
  return `votre ${label.toLowerCase()}`;
}

/**
 * Returns "un cardiologue" or "un medecin" (indefinite article, lowercase).
 */
export function getADoctorLabel(
  role?: string | null,
  specialty?: string | null,
): string {
  const label = getDoctorLabel(role, specialty);
  return `un ${label.toLowerCase()}`;
}
