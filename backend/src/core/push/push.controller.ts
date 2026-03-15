import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PushService } from './push.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Public } from '../guards/public.decorator';

@ApiTags('Push Notifications')
@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Get('vapid-key')
  @Public()
  @ApiOperation({ summary: 'Obtenir la cle publique VAPID' })
  getVapidKey() {
    const publicKey = this.pushService.getVapidPublicKey();
    return { publicKey };
  }

  @Post('subscribe')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Enregistrer une subscription push' })
  async subscribe(
    @CurrentUser('sub') userId: string,
    @Body() body: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) {
    return this.pushService.subscribe(userId, body);
  }

  @Post('unsubscribe')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Supprimer une subscription push' })
  async unsubscribe(
    @CurrentUser('sub') userId: string,
    @Body() body: { endpoint: string },
  ) {
    return this.pushService.unsubscribe(userId, body.endpoint);
  }

  @Post('test')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Envoyer une notification push de test' })
  async testPush(@CurrentUser('sub') userId: string) {
    const sent = await this.pushService.sendPush(userId, {
      title: 'T-Cardio',
      body: 'Les notifications push fonctionnent !',
      icon: '/logo.png',
      tag: 'test',
      data: { type: 'test' },
    });
    return { sent };
  }
}
