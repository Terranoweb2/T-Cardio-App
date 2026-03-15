import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ChatbotService } from './chatbot.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/guards/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';

@ApiTags('Chatbot')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PATIENT')
@Controller('chatbot')
export class ChatbotController {
  constructor(
    private readonly chatbotService: ChatbotService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('conversations')
  @ApiOperation({ summary: 'Creer une nouvelle conversation' })
  async createConversation(@CurrentUser('sub') userId: string, @Body() body: { title?: string }) {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) return { error: 'Patient introuvable' };
    return this.chatbotService.createConversation(patient.id, body.title);
  }

  @Post('conversations/with-measurements')
  @ApiOperation({ summary: 'Creer une conversation avec analyse automatique des mesures' })
  async createConversationWithMeasurements(@CurrentUser('sub') userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) return { error: 'Patient introuvable' };
    return this.chatbotService.createConversationWithMeasurements(patient.id);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Lister mes conversations' })
  async listConversations(@CurrentUser('sub') userId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) return [];
    return this.chatbotService.listConversations(patient.id);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Voir une conversation avec ses messages' })
  async getConversation(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) return { error: 'Patient introuvable' };
    return this.chatbotService.getConversation(patient.id, id);
  }

  @Post('conversations/:id/send')
  @ApiOperation({ summary: 'Envoyer un message et recevoir la reponse IA' })
  async sendMessage(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() body: { message: string },
  ) {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) return { error: 'Patient introuvable' };
    return this.chatbotService.sendMessage(patient.id, id, body.message);
  }

  @Delete('conversations/:id')
  @ApiOperation({ summary: 'Supprimer une conversation' })
  async deleteConversation(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) return { error: 'Patient introuvable' };
    return this.chatbotService.deleteConversation(patient.id, id);
  }
}
