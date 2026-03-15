import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionService } from '../../modules/subscription/subscription.service';

/**
 * Guard that checks if the current user has an active subscription.
 * - Bypasses for MEDECIN, CARDIOLOGUE, ADMIN (they don't need subscriptions).
 * - For PATIENT: verifies active subscription exists.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Non-patient roles have free access
    if (['MEDECIN', 'CARDIOLOGUE', 'ADMIN'].includes(user.role)) {
      return true;
    }

    // For patients, check subscription
    const patient = await this.prisma.patient.findUnique({
      where: { userId: user.sub },
    });

    if (!patient) {
      throw new ForbiddenException('Profil patient non trouve');
    }

    const hasSubscription =
      await this.subscriptionService.hasActiveSubscription(patient.id);

    if (!hasSubscription) {
      throw new ForbiddenException(
        'Abonnement requis. Veuillez souscrire a un abonnement pour acceder a cette fonctionnalite.',
      );
    }

    // Store patient on request for downstream use
    request.patient = patient;
    return true;
  }
}
