import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayConnection } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PushService } from '../../core/push/push.service';
import { CallNotificationGateway } from '../../core/push/call-notification.gateway';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/emergency' })
export class EmergencyGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(EmergencyGateway.name);

  constructor(
    private readonly pushService: PushService,
    private readonly callNotificationGateway: CallNotificationGateway,
    private readonly jwtService: JwtService,
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
        this.logger.warn(`[Auth] Emergency WS rejected: no token`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      client.data.userId = payload.sub;
      client.data.role = payload.role;
      this.logger.log(`[Auth] Emergency WS authenticated: user ${payload.sub} (${payload.role})`);
    } catch (err) {
      this.logger.warn(`[Auth] Emergency WS rejected: invalid token`);
      client.emit('error', { message: 'Invalid token' });
      client.disconnect();
    }
  }

  notifyDoctor(doctorId: string, event: any) {
    this.server.to(`doctor_${doctorId}`).emit('emergency', event);
    this.logger.log(`Emergency notification sent to doctor ${doctorId}`);
    // Push fallback — differentiate missed calls from emergencies
    if (event.type === 'missed_call') {
      this.pushService.sendMissedCallPush(doctorId, event.patientName || 'Patient', event.teleconsultationId).catch(() => {});
    } else {
      this.pushService.sendEmergencyPush(doctorId, event.message || 'Alerte urgence patient', event.severity).catch(() => {});
    }
  }

  notifyPatient(patientId: string, message: string) {
    this.server.to(`patient_${patientId}`).emit('emergency_alert', { message });
    // Push fallback for when patient is offline
    this.pushService.sendEmergencyPush(patientId, message).catch(() => {});
  }

  /**
   * Send an incoming call notification to a specific user (doctor or patient).
   * This uses the global emergency socket so the user receives it on ANY page.
   * Also sends a push notification for when the user has the app closed.
   */
  notifyIncomingCall(targetUserId: string, targetRole: string, data: {
    teleconsultationId: string;
    callerName: string;
    callerRole: string;
    callerId: string;
  }) {
    // PATIENT → patient_{id}, MEDECIN/CARDIOLOGUE/any doctor role → doctor_{id}
    const room = targetRole === 'PATIENT' ? `patient_${targetUserId}` : `doctor_${targetUserId}`;
    this.server.to(room).emit('incoming_call', data);
    this.logger.log(`Incoming call notification sent to ${targetRole} (room: ${room}) for teleconsultation ${data.teleconsultationId}`);

    // Also emit via /call-notification namespace for native Android service
    this.callNotificationGateway.notifyCall(targetUserId, targetRole, data);

    // Push notification for offline users
    this.pushService.sendCallPush(targetUserId, data.callerName, data.teleconsultationId).catch(() => {});
  }

  /**
   * Notify a user that a call was cancelled (caller hung up before answer).
   */
  notifyCallCancelled(targetUserId: string, targetRole: string, data: {
    teleconsultationId: string;
    reason: string;
  }) {
    // PATIENT → patient_{id}, MEDECIN/CARDIOLOGUE/any doctor role → doctor_{id}
    const room = targetRole === 'PATIENT' ? `patient_${targetUserId}` : `doctor_${targetUserId}`;
    this.server.to(room).emit('call_cancelled', data);
    this.logger.log(`Call cancelled notification sent to ${targetRole} (room: ${room})`);

    // Also emit via /call-notification namespace for native Android service
    this.callNotificationGateway.notifyCallCancelled(targetUserId, targetRole, data);
  }

  /**
   * Notify a doctor that a patient's profile has been updated.
   */
  notifyPatientProfileUpdated(doctorId: string, data: {
    patientId: string;
    patientName: string;
    updatedFields: string[];
  }) {
    this.server.to(`doctor_${doctorId}`).emit('patient_updated', data);
    this.logger.log(`Patient profile update notification sent to doctor ${doctorId} for patient ${data.patientId}`);
  }

  @SubscribeMessage('join')
  handleJoin(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId; // From JWT — never trust client payload
    const role = client.data.role;
    if (!userId || !role) { client.emit('error', { message: 'Not authenticated' }); return; }

    const room = role === 'PATIENT' ? `patient_${userId}` : `doctor_${userId}`;
    client.join(room);
    this.logger.log(`${role} ${userId} joined ${room}`);
  }
}
