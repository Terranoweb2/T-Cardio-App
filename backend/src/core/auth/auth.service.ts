import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

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
    onboardingCompleted: boolean;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  // ==================== REGISTRATION ====================

  async register(dto: RegisterDto): Promise<AuthResponse & { requiresEmailVerification?: boolean }> {
    const { email, password, role = 'PATIENT' } = dto;

    // SECURITY: Only allow safe roles via registration — ADMIN can only be created by existing admins
    const allowedRoles = ['PATIENT', 'MEDECIN', 'CARDIOLOGUE'];
    const safeRole = allowedRoles.includes(role) ? role : 'PATIENT';

    const existingUser = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new BadRequestException('ERR_EMAIL_EXISTS');
    }

    // Doctors/cardiologists need admin validation
    const status = safeRole === 'PATIENT' ? 'ACTIVE' : 'PENDING';

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        role: safeRole as any,
        status,
        emailVerified: false,
      },
    });

    // Auto-create patient profile for PATIENT role
    if (safeRole === 'PATIENT') {
      await this.prisma.patient.create({
        data: { userId: user.id },
      });
    }

    // Auto-create doctor profile for MEDECIN/CARDIOLOGUE roles
    if (safeRole === 'MEDECIN' || safeRole === 'CARDIOLOGUE') {
      await this.prisma.doctor.create({
        data: {
          userId: user.id,
          firstName: dto.firstName || '',
          lastName: dto.lastName || '',
          specialty: dto.specialty || 'Cardiologie',
          practicePhone: dto.phone || null,
          verificationStatus: 'PENDING',
          acceptingNewPatients: true,
          maxPatients: 50,
        },
      });
    }

    // Send verification email
    await this.sendVerificationCode(user.id, user.email);

    this.logger.log(`Nouvel utilisateur enregistre: ${user.email} (${user.role})`);

    const authResponse = await this.generateAuthResponse(user);
    return { ...authResponse, requiresEmailVerification: true };
  }

  // ==================== EMAIL VERIFICATION ====================

  async sendVerificationCode(userId: string, email?: string): Promise<void> {
    // Get user email if not provided
    if (!email) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new BadRequestException('Utilisateur non trouve');
      email = user.email;
    }

    // Invalidate previous codes
    await this.prisma.verificationCode.updateMany({
      where: {
        userId,
        type: 'EMAIL',
        verifiedAt: null,
      },
      data: {
        verifiedAt: new Date(), // mark as "used" to invalidate
      },
    });

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    // Store verification code (expires in 15 minutes)
    await this.prisma.verificationCode.create({
      data: {
        userId,
        type: 'EMAIL',
        codeHash,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min
      },
    });

    // Send email with code
    const sent = await this.emailService.sendEmail(
      email!,
      'T-Cardio Pro - Verification de votre email',
      `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <div style="max-width:500px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:30px 24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;">T-Cardio Pro</h1>
      <p style="color:#bfdbfe;margin:8px 0 0;font-size:14px;">Verification de votre adresse email</p>
    </div>
    <div style="padding:32px 24px;text-align:center;">
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">
        Bienvenue sur T-Cardio Pro ! Pour activer votre compte, veuillez saisir le code de verification ci-dessous :
      </p>
      <div style="background:#f0f9ff;border:2px dashed #3b82f6;border-radius:12px;padding:20px;margin:0 auto 24px;max-width:280px;">
        <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1d4ed8;font-family:'Courier New',monospace;">${code}</span>
      </div>
      <p style="color:#6b7280;font-size:13px;margin:0 0 8px;">
        Ce code est valable pendant <strong>15 minutes</strong>.
      </p>
      <p style="color:#9ca3af;font-size:12px;margin:0;">
        Si vous n'avez pas cree de compte, ignorez cet email.
      </p>
    </div>
    <div style="background:#f9fafb;padding:16px 24px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="color:#9ca3af;font-size:11px;margin:0;">T-Cardio Pro - Plateforme de telemedicine cardiologique</p>
    </div>
  </div>
</body>
</html>`,
    );

    if (sent) {
      this.logger.log(`Code de verification envoye a ${email}`);
    } else {
      // SECURITY: Do NOT auto-verify email when SMTP fails
      // Users must retry or contact support
      this.logger.warn(`Echec envoi code de verification a ${email} — l'utilisateur devra reessayer`);
    }
  }

  async verifyEmail(userId: string, code: string): Promise<{ success: boolean }> {
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    const verificationCode = await this.prisma.verificationCode.findFirst({
      where: {
        userId,
        type: 'EMAIL',
        verifiedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verificationCode) {
      throw new BadRequestException('Code expire ou invalide. Veuillez demander un nouveau code.');
    }

    // Check max attempts
    if (verificationCode.attempts >= verificationCode.maxAttempts) {
      throw new BadRequestException('Trop de tentatives. Veuillez demander un nouveau code.');
    }

    // Increment attempts
    await this.prisma.verificationCode.update({
      where: { id: verificationCode.id },
      data: { attempts: verificationCode.attempts + 1 },
    });

    // Verify code
    if (verificationCode.codeHash !== codeHash) {
      const remaining = verificationCode.maxAttempts - verificationCode.attempts - 1;
      throw new BadRequestException(
        `Code incorrect. ${remaining > 0 ? `${remaining} tentative(s) restante(s).` : 'Veuillez demander un nouveau code.'}`,
      );
    }

    // Mark code as verified
    await this.prisma.verificationCode.update({
      where: { id: verificationCode.id },
      data: { verifiedAt: new Date() },
    });

    // Mark user email as verified
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });

    this.logger.log(`Email verifie pour user ${userId}`);
    return { success: true };
  }

  async resendVerificationCode(userId: string): Promise<{ success: boolean; message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Utilisateur non trouve');
    if (user.emailVerified) throw new BadRequestException('Email deja verifie');

    // Rate limiting: check last code sent
    const lastCode = await this.prisma.verificationCode.findFirst({
      where: { userId, type: 'EMAIL' },
      orderBy: { createdAt: 'desc' },
    });

    if (lastCode) {
      const secondsSinceLastCode = (Date.now() - lastCode.createdAt.getTime()) / 1000;
      if (secondsSinceLastCode < 60) {
        throw new BadRequestException(
          `Veuillez attendre ${Math.ceil(60 - secondsSinceLastCode)} secondes avant de demander un nouveau code.`,
        );
      }
    }

    await this.sendVerificationCode(userId, user.email);
    return { success: true, message: 'Un nouveau code a ete envoye a votre adresse email.' };
  }

  // ==================== FORGOT / RESET PASSWORD ====================

  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      this.logger.log(`Forgot password attempt for non-existent email: ${email}`);
      return { success: true, message: 'Si cette adresse existe, un code de reinitialisation a ete envoye.' };
    }

    // Rate limiting: check last code sent
    // SECURITY: Return same generic response to prevent email enumeration
    const lastCode = await this.prisma.verificationCode.findFirst({
      where: { userId: user.id, type: 'PASSWORD_RESET' },
      orderBy: { createdAt: 'desc' },
    });

    if (lastCode) {
      const secondsSinceLastCode = (Date.now() - lastCode.createdAt.getTime()) / 1000;
      if (secondsSinceLastCode < 60) {
        // Return same message as "user not found" to prevent enumeration
        return { success: true, message: 'Si cette adresse existe, un code de reinitialisation a ete envoye.' };
      }
    }

    // Invalidate previous password reset codes
    await this.prisma.verificationCode.updateMany({
      where: {
        userId: user.id,
        type: 'PASSWORD_RESET',
        verifiedAt: null,
      },
      data: {
        verifiedAt: new Date(),
      },
    });

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    // Store code (expires in 15 minutes)
    await this.prisma.verificationCode.create({
      data: {
        userId: user.id,
        type: 'PASSWORD_RESET',
        codeHash,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    // Send email
    const sent = await this.emailService.sendEmail(
      user.email,
      'T-Cardio Pro - Reinitialisation de votre mot de passe',
      `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <div style="max-width:500px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:30px 24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;">T-Cardio Pro</h1>
      <p style="color:#fecaca;margin:8px 0 0;font-size:14px;">Reinitialisation du mot de passe</p>
    </div>
    <div style="padding:32px 24px;text-align:center;">
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">
        Vous avez demande la reinitialisation de votre mot de passe. Voici votre code de verification :
      </p>
      <div style="background:#fef2f2;border:2px dashed #ef4444;border-radius:12px;padding:20px;margin:0 auto 24px;max-width:280px;">
        <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#dc2626;font-family:'Courier New',monospace;">${code}</span>
      </div>
      <p style="color:#6b7280;font-size:13px;margin:0 0 8px;">
        Ce code est valable pendant <strong>15 minutes</strong>.
      </p>
      <p style="color:#9ca3af;font-size:12px;margin:0;">
        Si vous n'avez pas demande cette reinitialisation, ignorez cet email. Votre mot de passe ne sera pas modifie.
      </p>
    </div>
    <div style="background:#f9fafb;padding:16px 24px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="color:#9ca3af;font-size:11px;margin:0;">T-Cardio Pro - Plateforme de telemedicine cardiologique</p>
    </div>
  </div>
</body>
</html>`,
    );

    if (sent) {
      this.logger.log(`Code de reinitialisation envoye a ${user.email}`);
    } else {
      this.logger.warn(`Echec envoi code de reinitialisation a ${user.email}`);
    }

    return { success: true, message: 'Si cette adresse existe, un code de reinitialisation a ete envoye.' };
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new BadRequestException('Code invalide ou expire.');
    }

    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    const verificationCode = await this.prisma.verificationCode.findFirst({
      where: {
        userId: user.id,
        type: 'PASSWORD_RESET',
        verifiedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verificationCode) {
      throw new BadRequestException('Code expire ou invalide. Veuillez demander un nouveau code.');
    }

    // Check max attempts
    if (verificationCode.attempts >= verificationCode.maxAttempts) {
      throw new BadRequestException('Trop de tentatives. Veuillez demander un nouveau code.');
    }

    // Increment attempts
    await this.prisma.verificationCode.update({
      where: { id: verificationCode.id },
      data: { attempts: verificationCode.attempts + 1 },
    });

    // Verify code
    if (verificationCode.codeHash !== codeHash) {
      const remaining = verificationCode.maxAttempts - verificationCode.attempts - 1;
      throw new BadRequestException(
        `Code incorrect. ${remaining > 0 ? `${remaining} tentative(s) restante(s).` : 'Veuillez demander un nouveau code.'}`,
      );
    }

    // Mark code as verified
    await this.prisma.verificationCode.update({
      where: { id: verificationCode.id },
      data: { verifiedAt: new Date() },
    });

    // Update password
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Revoke all refresh tokens for security
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    this.logger.log(`Mot de passe reinitialise pour ${user.email}`);
    return { success: true };
  }

  // ==================== LOGIN ====================

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string): Promise<AuthResponse | { requires2FA: true }> {
    const { email, password, twoFactorCode } = dto;

    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('ERR_INVALID_CREDENTIALS');
    }

    // Check locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException('ERR_ACCOUNT_LOCKED');
    }

    // Check status
    if (user.status === 'SUSPENDED' || user.status === 'DELETED') {
      throw new ForbiddenException('ERR_ACCOUNT_INACTIVE');
    }

    if (user.status === 'PENDING' && user.role !== 'PATIENT') {
      throw new ForbiddenException('ERR_ACCOUNT_PENDING_VALIDATION');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      await this.handleFailedLogin(user.id, user.failedLoginAttempts);
      throw new UnauthorizedException('ERR_INVALID_CREDENTIALS');
    }

    // Reset failed attempts
    if (user.failedLoginAttempts > 0) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    // 2FA check
    if (user.twoFactorEnabled && !twoFactorCode) {
      return { requires2FA: true };
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    this.logger.log(`Login reussi: ${user.email} depuis ${ipAddress}`);
    return this.generateAuthResponse(user, ipAddress, userAgent);
  }

  // ==================== REFRESH TOKEN ====================

  async refreshToken(dto: RefreshTokenDto): Promise<AuthResponse> {
    const tokenHash = crypto.createHash('sha256').update(dto.refreshToken).digest('hex');

    const tokenRecord = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('ERR_INVALID_REFRESH_TOKEN');
    }

    // Revoke old token (rotation)
    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: new Date() },
    });

    return this.generateAuthResponse(tokenRecord.user);
  }

  // ==================== LOGOUT ====================

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    this.logger.log(`Logout: user ${userId}`);
  }

  // ==================== HELPERS ====================

  private async generateAuthResponse(
    user: { id: string; email: string; role: string; emailVerified: boolean; twoFactorEnabled: boolean; onboardingCompleted: boolean },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponse> {
    const sessionId = uuidv4();

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.generateRefreshToken(user.id, ipAddress, userAgent);

    return {
      accessToken,
      refreshToken,
      expiresIn: 604800, // 7 days in seconds
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        onboardingCompleted: user.onboardingCompleted,
      },
    };
  }

  private async generateRefreshToken(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<string> {
    const token = crypto.randomBytes(64).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        deviceInfo: { ipAddress, userAgent },
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    return token;
  }

  private async handleFailedLogin(userId: string, currentAttempts: number): Promise<void> {
    const newAttempts = currentAttempts + 1;
    const data: any = { failedLoginAttempts: newAttempts };

    if (newAttempts >= 5) {
      data.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 min lock
      this.logger.warn(`Compte verrouille apres ${newAttempts} tentatives`);
    }

    await this.prisma.user.update({ where: { id: userId }, data });
  }

  // ==================== GET PROFILE ====================
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerified: true,
        onboardingCompleted: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Utilisateur introuvable');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      onboardingCompleted: user.onboardingCompleted,
    };
  }
}
