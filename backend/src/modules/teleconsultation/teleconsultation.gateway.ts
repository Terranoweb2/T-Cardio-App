import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TeleconsultationService } from './teleconsultation.service';
import { EmergencyGateway } from '../emergency/emergency.gateway';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/teleconsultation' })
export class TeleconsultationGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(TeleconsultationGateway.name);

  // Track users in rooms for WebRTC signaling
  private roomUsers: Map<string, Set<string>> = new Map();
  // Track call timeouts (auto-cancel after 45 seconds if no answer)
  private callTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private readonly service: TeleconsultationService,
    private readonly emergencyGateway: EmergencyGateway,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Authenticate WebSocket connections via JWT token.
   * Rejects connections without a valid token.
   */
  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`[Auth] WebSocket rejected: no token`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      client.data.userId = payload.sub;
      client.data.role = payload.role;
      this.logger.log(`[Auth] WebSocket authenticated: user ${payload.sub} (${payload.role})`);
    } catch (err) {
      this.logger.warn(`[Auth] WebSocket rejected: invalid token`);
      client.emit('error', { message: 'Invalid token' });
      client.disconnect();
    }
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { teleconsultationId: string }) {
    const userId = client.data.userId; // From JWT — never trust client payload
    if (!userId) { client.emit('error', { message: 'Not authenticated' }); return; }

    const room = `tc_${data.teleconsultationId}`;
    client.join(room);
    client.data.room = room;

    // Track user in room
    if (!this.roomUsers.has(room)) {
      this.roomUsers.set(room, new Set());
    }
    this.roomUsers.get(room)!.add(userId);

    this.logger.log(`User ${userId} joined room ${room}`);

    // Notify others that a new user joined (for WebRTC)
    client.to(room).emit('user_joined', {
      userId,
      timestamp: new Date().toISOString(),
    });

    // Send current room participants to the joining user
    const participants = Array.from(this.roomUsers.get(room) || []);
    client.emit('room_participants', {
      teleconsultationId: data.teleconsultationId,
      participants,
    });

    // Auto-acknowledge active emergency events when doctor joins
    // (handled by EmergencyCallModule — no longer in TeleconsultationService)
  }

  @SubscribeMessage('send_message')
  async handleMessage(@ConnectedSocket() client: Socket, @MessageBody() data: {
    teleconsultationId: string;
    content: string;
    fileUrl?: string;
    fileName?: string;
    fileType?: string;
    fileSizeBytes?: number;
  }) {
    const senderId = client.data.userId; // From JWT — never trust client payload
    const senderRole = client.data.role;
    if (!senderId) { client.emit('error', { message: 'Not authenticated' }); return; }

    const message = await this.service.addMessage(
      data.teleconsultationId,
      senderId,
      senderRole,
      data.content,
      data.fileUrl ? {
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        fileType: data.fileType,
        fileSizeBytes: data.fileSizeBytes,
      } : undefined,
    );
    this.server.to(`tc_${data.teleconsultationId}`).emit('new_message', message);
  }

  @SubscribeMessage('leave_room')
  handleLeaveRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { teleconsultationId: string }) {
    const room = `tc_${data.teleconsultationId}`;
    client.leave(room);

    const userId = client.data.userId;
    if (userId && this.roomUsers.has(room)) {
      this.roomUsers.get(room)!.delete(userId);
      if (this.roomUsers.get(room)!.size === 0) {
        this.roomUsers.delete(room);
      }
    }

    // Notify others
    client.to(room).emit('user_left', {
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  // ============================================================
  // WebRTC Signaling - Pure peer-to-peer, no external dependencies
  // ============================================================

  /**
   * Initiator sends an SDP offer to the remote peer
   */
  @SubscribeMessage('webrtc_offer')
  handleWebRTCOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      teleconsultationId: string;
      targetUserId: string;
      sdp: RTCSessionDescriptionInit;
    },
  ) {
    const room = `tc_${data.teleconsultationId}`;
    this.logger.log(`WebRTC offer from ${client.data.userId} to ${data.targetUserId} in room ${room}`);

    // Forward the offer to the target user in the room
    client.to(room).emit('webrtc_offer', {
      fromUserId: client.data.userId,
      sdp: data.sdp,
    });
  }

  /**
   * Responder sends an SDP answer back
   */
  @SubscribeMessage('webrtc_answer')
  handleWebRTCAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      teleconsultationId: string;
      targetUserId: string;
      sdp: RTCSessionDescriptionInit;
    },
  ) {
    const room = `tc_${data.teleconsultationId}`;
    this.logger.log(`WebRTC answer from ${client.data.userId} to ${data.targetUserId} in room ${room}`);

    client.to(room).emit('webrtc_answer', {
      fromUserId: client.data.userId,
      sdp: data.sdp,
    });
  }

  /**
   * ICE candidate exchange for NAT traversal
   */
  @SubscribeMessage('webrtc_ice_candidate')
  handleICECandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      teleconsultationId: string;
      targetUserId: string;
      candidate: RTCIceCandidateInit;
    },
  ) {
    const room = `tc_${data.teleconsultationId}`;

    client.to(room).emit('webrtc_ice_candidate', {
      fromUserId: client.data.userId,
      candidate: data.candidate,
    });
  }

  /**
   * User joined late and wants to check if there's an active call
   * Broadcasts a re-signal request so the caller can resend their offer
   */
  @SubscribeMessage('call_check')
  handleCallCheck(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { teleconsultationId: string },
  ) {
    const room = `tc_${data.teleconsultationId}`;
    this.logger.log(`Call check requested by ${client.data.userId} in room ${room}`);

    // Ask the other party in the room to resend their call signal + offer
    client.to(room).emit('call_resignal_request', {
      requestingUserId: client.data.userId,
      teleconsultationId: data.teleconsultationId,
    });
  }

  /**
   * User signals they want to start a video call
   */
  @SubscribeMessage('call_start')
  async handleCallStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { teleconsultationId: string },
  ) {
    const room = `tc_${data.teleconsultationId}`;
    const callerUserId = client.data.userId;
    this.logger.log(`Call started by ${callerUserId} in room ${room}`);

    // 1. Emit call_incoming to anyone already in the teleconsultation room
    client.to(room).emit('call_incoming', {
      fromUserId: callerUserId,
      teleconsultationId: data.teleconsultationId,
      timestamp: new Date().toISOString(),
    });

    // 2. Send global incoming_call notification via emergency socket
    //    so the other party receives it on ANY page
    await this.service.notifyIncomingCallGlobal(
      data.teleconsultationId,
      callerUserId,
    );

    // 3. Check if doctor is in the room; if not, send missed-call notification
    const roomParticipants = this.roomUsers.get(room) || new Set();
    await this.service.handleMissedCallCheck(
      data.teleconsultationId,
      callerUserId,
      Array.from(roomParticipants),
    );

    // 4. Set a 45-second timeout to auto-cancel the call if not accepted
    const timeoutKey = `call_${data.teleconsultationId}`;
    // Clear any existing timeout for this consultation
    if (this.callTimeouts.has(timeoutKey)) {
      clearTimeout(this.callTimeouts.get(timeoutKey)!);
    }
    const timeout = setTimeout(async () => {
      this.callTimeouts.delete(timeoutKey);
      // Emit call_ended to the room (in case caller is still there)
      this.server.to(room).emit('call_ended', {
        fromUserId: 'system',
        reason: 'timeout',
      });
      // Also notify the other party globally that call was cancelled
      await this.service.notifyCallCancelledGlobal(
        data.teleconsultationId,
        callerUserId,
        'timeout',
      );
      this.logger.log(`Call timed out for teleconsultation ${data.teleconsultationId}`);
    }, 45_000);
    this.callTimeouts.set(timeoutKey, timeout);
  }

  /**
   * User accepts incoming call
   */
  @SubscribeMessage('call_accept')
  async handleCallAccept(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { teleconsultationId: string },
  ) {
    const room = `tc_${data.teleconsultationId}`;
    this.logger.log(`Call accepted by ${client.data.userId} in room ${room}`);

    // Clear the call timeout since the call was accepted
    const timeoutKey = `call_${data.teleconsultationId}`;
    if (this.callTimeouts.has(timeoutKey)) {
      clearTimeout(this.callTimeouts.get(timeoutKey)!);
      this.callTimeouts.delete(timeoutKey);
    }

    // Update teleconsultation status to ACTIVE (triggers credit deduction)
    try {
      await this.service.updateStatus(data.teleconsultationId, 'ACTIVE' as any);
      this.logger.log(`Teleconsultation ${data.teleconsultationId} set to ACTIVE (credits deducted)`);
    } catch (err) {
      this.logger.warn(`Failed to set teleconsultation ACTIVE: ${err}`);
    }

    client.to(room).emit('call_accepted', {
      fromUserId: client.data.userId,
      teleconsultationId: data.teleconsultationId,
    });
  }

  /**
   * User rejects / ends the call
   */
  @SubscribeMessage('call_end')
  async handleCallEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { teleconsultationId: string; reason?: string },
  ) {
    const room = `tc_${data.teleconsultationId}`;
    const reason = data.reason || 'user_hangup';
    this.logger.log(`Call ended by ${client.data.userId} in room ${room}: ${reason}`);

    // Clear the call timeout
    const timeoutKey = `call_${data.teleconsultationId}`;
    if (this.callTimeouts.has(timeoutKey)) {
      clearTimeout(this.callTimeouts.get(timeoutKey)!);
      this.callTimeouts.delete(timeoutKey);
    }

    // Update teleconsultation status to ENDED (only if it was ACTIVE)
    try {
      await this.service.updateStatus(data.teleconsultationId, 'ENDED' as any, client.data.userId);
      this.logger.log(`Teleconsultation ${data.teleconsultationId} set to ENDED`);
    } catch (err) {
      this.logger.warn(`Failed to set teleconsultation ENDED: ${err}`);
    }

    client.to(room).emit('call_ended', {
      fromUserId: client.data.userId,
      reason,
    });

    // Also notify globally (in case the other party is not on the teleconsultation page)
    await this.service.notifyCallCancelledGlobal(
      data.teleconsultationId,
      client.data.userId,
      reason,
    );
  }

  /**
   * Toggle media tracks (mute/unmute audio, enable/disable video)
   */
  @SubscribeMessage('media_toggle')
  handleMediaToggle(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      teleconsultationId: string;
      kind: 'audio' | 'video';
      enabled: boolean;
    },
  ) {
    const room = `tc_${data.teleconsultationId}`;

    client.to(room).emit('media_toggled', {
      fromUserId: client.data.userId,
      kind: data.kind,
      enabled: data.enabled,
    });
  }

  /**
   * Cleanup on disconnect
   */
  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    const room = client.data.room;

    if (userId && room) {
      if (this.roomUsers.has(room)) {
        this.roomUsers.get(room)!.delete(userId);
        if (this.roomUsers.get(room)!.size === 0) {
          this.roomUsers.delete(room);
        }
      }

      // Notify room that user disconnected (auto-end call)
      this.server.to(room).emit('user_disconnected', {
        userId,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`User ${userId} disconnected from room ${room}`);
    }
  }
}
