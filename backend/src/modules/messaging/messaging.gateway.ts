import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { MessagingService } from './messaging.service';
import { AutoReplyService } from './auto-reply.service';
import { PushService } from '../../core/push/push.service';
import { PrismaService } from '../../core/prisma/prisma.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/messaging',
})
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagingGateway.name);

  constructor(
    private readonly messagingService: MessagingService,
    private readonly autoReplyService: AutoReplyService,
    private readonly pushService: PushService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Authenticate WebSocket connections via JWT token.
   */
  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`[Auth] Messaging WS rejected: no token`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      client.data.userId = payload.sub;
      client.data.role = payload.role;
      this.logger.log(`[Auth] Messaging WS authenticated: user ${payload.sub} (${payload.role})`);
    } catch (err) {
      this.logger.warn(`[Auth] Messaging WS rejected: invalid token`);
      client.emit('error', { message: 'Invalid token' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Messaging client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_conversation')
  handleJoinConversation(client: Socket, data: { conversationId: string }) {
    const userId = client.data.userId;
    if (!userId) { client.emit('error', { message: 'Not authenticated' }); return; }

    const room = `msg_${data.conversationId}`;
    client.join(room);
    client.data.conversationId = data.conversationId;
    this.logger.log(`User ${userId} joined conversation ${data.conversationId}`);
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    client: Socket,
    data: { conversationId: string; content: string },
  ) {
    const senderId = client.data.userId;
    const senderRole = client.data.role;
    if (!senderId) { client.emit('error', { message: 'Not authenticated' }); return; }

    try {
      const message = await this.messagingService.sendMessage(
        data.conversationId,
        senderId,
        senderRole,
        data.content,
      );
      this.server.to(`msg_${data.conversationId}`).emit('new_message', message);

      // Send push to the other participant
      this.sendPushToRecipient(data.conversationId, senderId, data.content).catch(() => {});

      // AI Auto-Reply: only trigger for patient messages
      if (senderRole === 'PATIENT') {
        this.triggerAutoReply(data.conversationId, data.content).catch((err) => {
          this.logger.debug(`Auto-reply skipped: ${err.message}`);
        });
      }
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('typing')
  handleTyping(client: Socket, data: { conversationId: string }) {
    client.to(`msg_${data.conversationId}`).emit('user_typing', {
      userId: client.data.userId,
    });
  }

  @SubscribeMessage('stop_typing')
  handleStopTyping(client: Socket, data: { conversationId: string }) {
    client.to(`msg_${data.conversationId}`).emit('user_stop_typing', {
      userId: client.data.userId,
    });
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(client: Socket, data: { conversationId: string }) {
    const userId = client.data.userId;
    if (!userId) { client.emit('error', { message: 'Not authenticated' }); return; }

    try {
      await this.messagingService.markAsRead(data.conversationId, userId);
      this.server.to(`msg_${data.conversationId}`).emit('messages_read', {
        userId,
      });
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('toggle_auto_reply')
  async handleToggleAutoReply(
    client: Socket,
    data: { enabled: boolean; durationMinutes?: number },
  ) {
    const userId = client.data.userId;
    const role = client.data.role;
    if (!userId) { client.emit('error', { message: 'Not authenticated' }); return; }
    if (role !== 'MEDECIN' && role !== 'CARDIOLOGUE') {
      client.emit('error', { message: 'Seuls les medecins peuvent activer la reponse auto IA' });
      return;
    }

    try {
      const doctor = await this.prisma.doctor.findUnique({ where: { userId } });
      if (!doctor) { client.emit('error', { message: 'Medecin non trouve' }); return; }

      const result = await this.autoReplyService.toggleAutoReply(
        doctor.id, data.enabled, data.durationMinutes,
      );
      client.emit('auto_reply_status', {
        enabled: result.aiAutoReplyEnabled,
        expiresAt: result.aiAutoReplyExpiresAt,
      });
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  /**
   * Trigger AI auto-reply after a patient sends a message.
   */
  private async triggerAutoReply(conversationId: string, patientMessage: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { doctorId: true, doctor: { select: { userId: true } } },
    });
    if (!conversation) return;

    const isActive = await this.autoReplyService.isAutoReplyActive(conversation.doctorId);
    if (!isActive) return;

    // Emit typing indicator from the "doctor" side
    this.server.to(`msg_${conversationId}`).emit('user_typing', {
      userId: conversation.doctor.userId,
    });

    // Generate the AI reply (may take 2-5 seconds)
    const aiMessage = await this.autoReplyService.generateAutoReply(conversationId, patientMessage);

    // Stop typing indicator
    this.server.to(`msg_${conversationId}`).emit('user_stop_typing', {
      userId: conversation.doctor.userId,
    });

    if (aiMessage) {
      this.server.to(`msg_${conversationId}`).emit('new_message', aiMessage);
      this.sendPushToRecipient(conversationId, conversation.doctor.userId, aiMessage.content).catch(() => {});
    }
  }

  private async sendPushToRecipient(conversationId: string, senderId: string, content: string) {
    try {
      const recipientUserId = await this.messagingService.getRecipientUserId(conversationId, senderId);
      if (!recipientUserId) return;

      const senderName = await this.messagingService.getSenderName(senderId);
      await this.pushService.sendMessagePush(
        recipientUserId,
        senderName || 'Nouveau message',
        content,
      );
    } catch (error) {
      this.logger.debug(`Push message notification failed: ${error.message}`);
    }
  }
}
