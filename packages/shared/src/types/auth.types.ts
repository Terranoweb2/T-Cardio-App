export enum Role {
  PATIENT = 'PATIENT',
  MEDECIN = 'MEDECIN',
  CARDIOLOGUE = 'CARDIOLOGUE',
  ADMIN = 'ADMIN',
}

export interface TokenPayload {
  sub: string;
  email: string;
  role: Role;
  sessionId: string;
  iat: number;
  exp: number;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    role: string;
    emailVerified: boolean;
    twoFactorEnabled: boolean;
  };
}
