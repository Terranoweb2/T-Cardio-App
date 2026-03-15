import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayConnection } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * Dedicated Socket.io namespace for incoming call notifications.
 *
 * This gateway is designed to be consumed by the native Android
 * CallNotificationService, which maintains a persistent WebSocket
 * connection even when the app is backgrounded or killed.
 *
 * The Android service connects via OkHttp WebSocket and listens
 * for 'incoming_call' events to show full-screen notifications.
 */
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/call-notification',
  pingInterval: 25000,
  pingTimeout: 10000,
})
export class CallNotificationGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(CallNotificationGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  /**
   * Authenticate WebSocket connections via JWT token.
   */
  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`[Auth] Call-notification WS rejected: no token`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      client.data.userId = payload.sub;
      client.data.role = payload.role;
      this.logger.log(`[Auth] Call-notification WS authenticated: user ${payload.sub} (${payload.role})`);
    } catch (err) {
      this.logger.warn(`[Auth] Call-notification WS rejected: invalid token`);
      client.emit('error', { message: 'Invalid token' });
      client.disconnect();
    }
  }

  @SubscribeMessage('join')
  handleJoin(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId; // From JWT — never trust client payload
    const role = client.data.role;
    if (!userId || !role) {
      this.logger.warn('call-notification join: not authenticated');
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    const room =
      role === 'PATIENT'
        ? `patient_${userId}`
        : `doctor_${userId}`;

    client.join(room);
    this.logger.log(
      `[call-notification] ${role} ${userId} joined ${room}`,
    );

    // Acknowledge the join so the native service knows it's connected
    client.emit('joined', { room, status: 'ok' });
  }

  /**
   * Called by EmergencyGateway when an incoming call needs to be sent.
   * Emits to both patient and doctor rooms so either side can receive.
   */
  notifyCall(
    targetUserId: string,
    targetRole: string,
    data: {
      teleconsultationId: string;
      callerName: string;
      callerRole: string;
      callerId: string;
    },
  ) {
    const room =
      targetRole === 'PATIENT'
        ? `patient_${targetUserId}`
        : `doctor_${targetUserId}`;

    this.server.to(room).emit('incoming_call', data);
    this.logger.log(
      `[call-notification] Incoming call sent to ${targetRole} ${targetUserId} (room: ${room})`,
    );
  }

  /**
   * Notify that a call was cancelled so the native service can dismiss the notification.
   */
  notifyCallCancelled(
    targetUserId: string,
    targetRole: string,
    data: { teleconsultationId: string; reason: string },
  ) {
    const room =
      targetRole === 'PATIENT'
        ? `patient_${targetUserId}`
        : `doctor_${targetUserId}`;

    this.server.to(room).emit('call_cancelled', data);
  }
}
