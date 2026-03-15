// NOTE: This service requires the following packages to be installed:
//   npm install otplib qrcode
//   npm install -D @types/qrcode
// Run: npm install otplib qrcode && npm install -D @types/qrcode

import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);
  private readonly appName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.appName = this.configService.get<string>('APP_NAME', 'T-Cardio Pro');
  }

  /**
   * Generate a TOTP secret for the user and return the otpauth URL.
   * The secret is stored in the user record but 2FA is NOT yet enabled --
   * the user must call enableTwoFactor() with a valid token first.
   */
  async generateSecret(userId: string): Promise<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const secret = authenticator.generateSecret();

    const otpauthUrl = authenticator.keyuri(user.email, this.appName, secret);

    // Store the secret (not yet enabled)
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    this.logger.log(`2FA secret generated for user ${user.email}`);

    return {
      secret,
      otpauthUrl,
      qrCodeDataUrl,
    };
  }

  /**
   * Verify a 6-digit TOTP token against the user's stored secret.
   */
  async verifyToken(userId: string, token: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.twoFactorSecret) {
      throw new BadRequestException('2FA not configured for this user');
    }

    return authenticator.verify({
      token,
      secret: user.twoFactorSecret,
    });
  }

  /**
   * Enable 2FA for the user after verifying the provided token.
   * This ensures the user has correctly set up their authenticator app.
   */
  async enableTwoFactor(userId: string, token: string): Promise<{ enabled: boolean }> {
    const isValid = await this.verifyToken(userId, token);

    if (!isValid) {
      throw new BadRequestException('Invalid 2FA token. Please try again.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });

    this.logger.log(`2FA enabled for user ${userId}`);

    return { enabled: true };
  }

  /**
   * Disable 2FA for the user after verifying the provided token.
   * Clears the stored secret as well.
   */
  async disableTwoFactor(userId: string, token: string): Promise<{ disabled: boolean }> {
    const isValid = await this.verifyToken(userId, token);

    if (!isValid) {
      throw new BadRequestException('Invalid 2FA token. Cannot disable.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    this.logger.log(`2FA disabled for user ${userId}`);

    return { disabled: true };
  }
}
