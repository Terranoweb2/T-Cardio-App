import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SetMetadata } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreditService } from '../../modules/credit/credit.service';

// ─── Decorator ───
export const REQUIRED_CREDITS_KEY = 'required_credits';
export const RequiredCredits = (amount: number) =>
  SetMetadata(REQUIRED_CREDITS_KEY, amount);

/**
 * Guard that checks if the current patient has enough credits.
 * - Bypasses for MEDECIN, CARDIOLOGUE, ADMIN.
 * - For PATIENT: reads @RequiredCredits(amount) and checks balance.
 */
@Injectable()
export class CreditGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly creditService: CreditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredCredits = this.reflector.getAllAndOverride<number>(
      REQUIRED_CREDITS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @RequiredCredits decorator → allow
    if (requiredCredits === undefined || requiredCredits === null) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Non-patient roles bypass credit check
    if (['MEDECIN', 'CARDIOLOGUE', 'ADMIN'].includes(user.role)) {
      return true;
    }

    // Use patient from SubscriptionGuard if available
    let patient = request.patient;
    if (!patient) {
      patient = await this.prisma.patient.findUnique({
        where: { userId: user.sub },
      });
    }

    if (!patient) {
      throw new ForbiddenException('Profil patient non trouve');
    }

    const hasSufficient = await this.creditService.hasSufficientCredits(
      patient.id,
      requiredCredits,
    );

    if (!hasSufficient) {
      const balance = await this.creditService.getBalance(patient.id);
      throw new ForbiddenException(
        `Credits insuffisants. Solde: ${balance} XOF, requis: ${requiredCredits} XOF. Rechargez vos credits.`,
      );
    }

    request.patient = patient;
    return true;
  }
}
