import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async createConversation(userId: string, role: string, targetId: string) {
    // Determine patientId and doctorId based on role
    let patientId: string;
    let doctorId: string;

    if (role === 'PATIENT') {
      const patient = await this.prisma.patient.findUnique({ where: { userId } });
      if (!patient) throw new NotFoundException('Patient introuvable');
      patientId = patient.id;
      doctorId = targetId;
    } else {
      const doctor = await this.prisma.doctor.findUnique({ where: { userId } });
      if (!doctor) throw new NotFoundException('Medecin introuvable');
      doctorId = doctor.id;
      patientId = targetId;
    }

    // Verify active link exists
    const link = await this.prisma.patientDoctorLink.findFirst({
      where: { patientId, doctorId, status: 'ACTIVE' },
    });
    if (!link) throw new ForbiddenException('Aucun lien actif entre ce patient et ce medecin');

    // Always create a new conversation
    const conversation = await this.prisma.conversation.create({
      data: { patientId, doctorId },
      include: {
        patient: { select: { firstName: true, lastName: true, profilePhotoUrl: true } },
        doctor: { select: { firstName: true, lastName: true, profilePhotoUrl: true } },
      },
    });

    return conversation;
  }

  async getConversations(userId: string, role: string) {
    let where: any;

    this.logger.log(`getConversations called: userId=${userId}, role=${role}`);

    if (role === 'PATIENT') {
      const patient = await this.prisma.patient.findUnique({ where: { userId } });
      if (!patient) {
        this.logger.warn(`No patient found for userId=${userId}`);
        return [];
      }
      where = { patientId: patient.id };
    } else {
      const doctor = await this.prisma.doctor.findUnique({ where: { userId } });
      if (!doctor) {
        this.logger.warn(`No doctor found for userId=${userId}, role=${role} — messaging will be empty`);
        return [];
      }
      this.logger.log(`Doctor found: id=${doctor.id}, name=${doctor.firstName} ${doctor.lastName}`);
      where = { doctorId: doctor.id };
    }

    const conversations = await this.prisma.conversation.findMany({
      where,
      orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
      include: {
        patient: { select: { firstName: true, lastName: true, profilePhotoUrl: true } },
        doctor: { select: { firstName: true, lastName: true, profilePhotoUrl: true } },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { content: true, senderRole: true, createdAt: true, isRead: true },
        },
      },
    });

    this.logger.log(`Found ${conversations.length} conversations for ${role} userId=${userId}`);
    return conversations;
  }

  async getMessages(conversationId: string, userId: string, cursor?: string, limit = 50) {
    // Verify user belongs to conversation
    await this.verifyConversationAccess(conversationId, userId);

    const messages = await this.prisma.directMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    return messages.reverse();
  }

  async sendMessage(
    conversationId: string,
    senderId: string,
    senderRole: string,
    content: string,
    fileData?: { url: string; name: string; type: string; size: number },
    isAiGenerated: boolean = false,
  ) {
    await this.verifyConversationAccess(conversationId, senderId);

    const message = await this.prisma.directMessage.create({
      data: {
        conversationId,
        senderId,
        senderRole: senderRole as any,
        content,
        fileUrl: fileData?.url,
        fileName: fileData?.name,
        fileType: fileData?.type,
        fileSizeBytes: fileData?.size,
        isAiGenerated,
      },
    });

    // Update conversation lastMessageAt
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    return message;
  }

  async markAsRead(conversationId: string, userId: string) {
    await this.verifyConversationAccess(conversationId, userId);

    await this.prisma.directMessage.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        isRead: false,
      },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async getUnreadCount(userId: string, role: string) {
    let conversationIds: string[];

    if (role === 'PATIENT') {
      const patient = await this.prisma.patient.findUnique({ where: { userId } });
      if (!patient) return 0;
      const convs = await this.prisma.conversation.findMany({
        where: { patientId: patient.id },
        select: { id: true },
      });
      conversationIds = convs.map((c) => c.id);
    } else {
      const doctor = await this.prisma.doctor.findUnique({ where: { userId } });
      if (!doctor) return 0;
      const convs = await this.prisma.conversation.findMany({
        where: { doctorId: doctor.id },
        select: { id: true },
      });
      conversationIds = convs.map((c) => c.id);
    }

    if (conversationIds.length === 0) return 0;

    return this.prisma.directMessage.count({
      where: {
        conversationId: { in: conversationIds },
        senderId: { not: userId },
        isRead: false,
      },
    });
  }

  /**
   * Get the userId of the other participant in a conversation (for push notifications).
   */
  async getRecipientUserId(conversationId: string, senderId: string): Promise<string | null> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        patient: { select: { userId: true } },
        doctor: { select: { userId: true } },
      },
    });
    if (!conversation) return null;

    if (conversation.patient.userId === senderId) {
      return conversation.doctor.userId;
    }
    if (conversation.doctor.userId === senderId) {
      return conversation.patient.userId;
    }
    return null;
  }

  /**
   * Get the display name of a user (for push notification title).
   */
  async getSenderName(userId: string): Promise<string | null> {
    const patient = await this.prisma.patient.findUnique({
      where: { userId },
      select: { firstName: true, lastName: true },
    });
    if (patient) {
      return [patient.firstName, patient.lastName].filter(Boolean).join(' ') || null;
    }

    const doctor = await this.prisma.doctor.findUnique({
      where: { userId },
      select: { firstName: true, lastName: true },
    });
    if (doctor) {
      return `Dr. ${[doctor.firstName, doctor.lastName].filter(Boolean).join(' ')}` || null;
    }

    return null;
  }

  private async verifyConversationAccess(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        patient: { select: { userId: true } },
        doctor: { select: { userId: true } },
      },
    });

    if (!conversation) throw new NotFoundException('Conversation introuvable');
    if (conversation.patient.userId !== userId && conversation.doctor.userId !== userId) {
      throw new ForbiddenException('Acces refuse a cette conversation');
    }

    return conversation;
  }
}
