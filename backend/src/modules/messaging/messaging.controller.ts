import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MessagingService } from './messaging.service';
import { AutoReplyService } from './auto-reply.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/guards/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';

@ApiTags('Messaging')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('messaging')
export class MessagingController {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly autoReplyService: AutoReplyService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('conversations')
  @ApiOperation({ summary: 'Lister mes conversations' })
  async getConversations(
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.messagingService.getConversations(userId, role);
  }

  @Post('conversations')
  @ApiOperation({ summary: 'Creer une nouvelle conversation' })
  async createConversation(
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: string,
    @Body() body: { targetId: string },
  ) {
    return this.messagingService.createConversation(userId, role, body.targetId);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Messages d\'une conversation' })
  async getMessages(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messagingService.getMessages(id, userId, cursor, limit ? parseInt(limit) : 50);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Envoyer un message (REST)' })
  async sendMessage(
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: string,
    @Param('id') id: string,
    @Body() body: { content: string },
  ) {
    return this.messagingService.sendMessage(id, userId, role, body.content);
  }

  @Patch('conversations/:id/read')
  @ApiOperation({ summary: 'Marquer les messages comme lus' })
  async markAsRead(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    await this.messagingService.markAsRead(id, userId);
    return { success: true };
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Nombre total de messages non lus' })
  async getUnreadCount(
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: string,
  ) {
    const count = await this.messagingService.getUnreadCount(userId, role);
    return { count };
  }

  @Patch('auto-reply')
  @UseGuards(RolesGuard)
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Activer/desactiver la reponse auto IA' })
  async toggleAutoReply(
    @CurrentUser('sub') userId: string,
    @Body() body: { enabled: boolean; durationMinutes?: number },
  ) {
    const doctor = await this.prisma.doctor.findUnique({ where: { userId } });
    if (!doctor) throw new NotFoundException('Medecin non trouve');
    return this.autoReplyService.toggleAutoReply(doctor.id, body.enabled, body.durationMinutes);
  }

  @Get('auto-reply/status')
  @UseGuards(RolesGuard)
  @Roles('MEDECIN', 'CARDIOLOGUE')
  @ApiOperation({ summary: 'Statut de la reponse auto IA' })
  async getAutoReplyStatus(@CurrentUser('sub') userId: string) {
    const doctor = await this.prisma.doctor.findUnique({ where: { userId } });
    if (!doctor) throw new NotFoundException('Medecin non trouve');
    return this.autoReplyService.getAutoReplyStatus(doctor.id);
  }
}
