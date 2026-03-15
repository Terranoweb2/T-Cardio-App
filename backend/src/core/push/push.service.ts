import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as webpush from 'web-push';

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: Record<string, any>;
  requireInteraction?: boolean;
}

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private enabled = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:contact@t-cardio.org';

    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.enabled = true;
      this.logger.log('Web Push (VAPID) configure et actif');
    } else {
      this.logger.warn('VAPID keys non configurees — push notifications desactivees');
    }
  }

  getVapidPublicKey(): string | null {
    return process.env.VAPID_PUBLIC_KEY || null;
  }

  async subscribe(userId: string, subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      update: {
        userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
    return { success: true };
  }

  async sendPush(userId: string, payload: PushPayload): Promise<number> {
    if (!this.enabled) return 0;

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) return 0;

    const jsonPayload = JSON.stringify(payload);
    let sent = 0;

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          jsonPayload,
        );
        sent++;
      } catch (error: any) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          // Subscription expired or invalid — clean up
          await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          this.logger.debug(`Subscription expiree supprimee: ${sub.endpoint.slice(0, 50)}...`);
        } else {
          this.logger.error(`Push echoue pour ${sub.endpoint.slice(0, 50)}: ${error.message}`);
        }
      }
    }

    return sent;
  }

  // ==================== CONVENIENCE METHODS ====================

  async sendCallPush(userId: string, callerName: string, teleconsultationId: string) {
    return this.sendPush(userId, {
      title: 'Appel entrant',
      body: `${callerName} vous appelle...`,
      icon: '/logo-T-Cardio.png',
      tag: 'incoming-call',
      requireInteraction: true,
      data: { type: 'call', teleconsultationId },
    });
  }

  async sendMessagePush(userId: string, senderName: string, preview: string) {
    return this.sendPush(userId, {
      title: `Message de ${senderName}`,
      body: preview.length > 100 ? preview.slice(0, 97) + '...' : preview,
      icon: '/logo-T-Cardio.png',
      tag: `message-${Date.now()}`,
      data: { type: 'message' },
    });
  }

  async sendEmergencyPush(userId: string, message: string, severity?: string) {
    return this.sendPush(userId, {
      title: 'Alerte urgence',
      body: message,
      icon: '/logo-T-Cardio.png',
      tag: 'emergency',
      requireInteraction: true,
      data: { type: 'emergency', severity },
    });
  }

  async sendReminderPush(userId: string, message: string) {
    return this.sendPush(userId, {
      title: 'Rappel de mesure',
      body: message,
      icon: '/logo-T-Cardio.png',
      tag: 'reminder',
      data: { type: 'reminder' },
    });
  }

  async sendMissedCallPush(userId: string, callerName: string, teleconsultationId: string) {
    return this.sendPush(userId, {
      title: 'Appel manque',
      body: `${callerName} a essaye de vous appeler.`,
      icon: '/logo-T-Cardio.png',
      tag: `missed-call-${teleconsultationId}`,
      requireInteraction: true,
      data: { type: 'missed_call', teleconsultationId },
    });
  }
}
