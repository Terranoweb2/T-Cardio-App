export const ROLES = {
  PATIENT: 'PATIENT',
  MEDECIN: 'MEDECIN',
  CARDIOLOGUE: 'CARDIOLOGUE',
  ADMIN: 'ADMIN',
} as const;

export const MEDICAL_ROLES = [ROLES.MEDECIN, ROLES.CARDIOLOGUE] as const;

export const ALL_ROLES = Object.values(ROLES);
