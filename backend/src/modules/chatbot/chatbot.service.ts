import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CHATBOT_SYSTEM_PROMPT } from './chatbot-system-prompt';
import OpenAI from 'openai';

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private readonly client: OpenAI;
  private readonly modelName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.client = new OpenAI({
      apiKey: this.configService.get<string>('DEEPSEEK_API_KEY'),
      baseURL: this.configService.get<string>('DEEPSEEK_BASE_URL', 'https://api.deepseek.com'),
    });
    this.modelName = this.configService.get<string>('DEEPSEEK_MODEL', 'deepseek-chat');
  }

  async createConversation(patientId: string, title?: string) {
    return this.prisma.chatConversation.create({
      data: {
        patientId,
        title: title || 'Nouvelle conversation',
      },
    });
  }

  /**
   * Create a new conversation with automatic health analysis.
   * Fetches patient's recent measurements and asks the AI to comment on them
   * and provide health advice. The AI starts with "Vos dernieres mesures sont les suivantes..."
   */
  async createConversationWithMeasurements(patientId: string) {
    // 1. Fetch patient info
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
    });

    // 2. Fetch recent measurements (last 30 days, max 10)
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const measurements = await this.prisma.bpMeasurement.findMany({
      where: { patientId, measuredAt: { gte: since } },
      orderBy: { measuredAt: 'desc' },
      take: 10,
    });

    // 3. Fetch stats
    const allMeasurements = await this.prisma.bpMeasurement.findMany({
      where: { patientId, measuredAt: { gte: since } },
      orderBy: { measuredAt: 'asc' },
    });

    let statsText = '';
    if (allMeasurements.length > 0) {
      const systolics = allMeasurements.map((m) => m.systolic);
      const diastolics = allMeasurements.map((m) => m.diastolic);
      const pulses = allMeasurements.filter((m) => m.pulse).map((m) => m.pulse!);
      const avgSys = Math.round(systolics.reduce((a, b) => a + b, 0) / systolics.length);
      const avgDia = Math.round(diastolics.reduce((a, b) => a + b, 0) / diastolics.length);
      const avgPulse = pulses.length > 0 ? Math.round(pulses.reduce((a, b) => a + b, 0) / pulses.length) : null;
      statsText = `\nMoyennes sur 30 jours: Systolique ${avgSys} mmHg, Diastolique ${avgDia} mmHg${avgPulse ? `, Pouls ${avgPulse} bpm` : ''}.`;
      statsText += `\nNombre total de mesures: ${allMeasurements.length}.`;
      const emergencies = allMeasurements.filter((m) => m.isEmergency).length;
      if (emergencies > 0) {
        statsText += `\nATTENTION: ${emergencies} mesure(s) critique(s) detectee(s) sur cette periode.`;
      }
    }

    // 4. Build measurements text
    let measurementsText = '';
    if (measurements.length === 0) {
      measurementsText = 'Le patient n\'a aucune mesure enregistree sur les 30 derniers jours.';
    } else {
      measurementsText = 'Voici les dernieres mesures du patient (de la plus recente a la plus ancienne):\n';
      for (const m of measurements) {
        const date = new Date(m.measuredAt).toLocaleDateString('fr-FR', {
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
        });
        measurementsText += `- ${date}: ${m.systolic}/${m.diastolic} mmHg`;
        if (m.pulse) measurementsText += `, Pouls: ${m.pulse} bpm`;
        measurementsText += ` (Risque: ${m.riskLevel})`;
        if (m.context && m.context !== 'INCONNU') measurementsText += ` [Contexte: ${m.context}]`;
        measurementsText += '\n';
      }
      measurementsText += statsText;
    }

    const patientName = patient ? `${patient.firstName || ''} ${patient.lastName || ''}`.trim() : 'Patient';

    // 5. Create conversation
    const conv = await this.prisma.chatConversation.create({
      data: {
        patientId,
        title: 'Analyse de mes constantes',
      },
    });

    // 6. Build the special system prompt with measurements context
    const measurementSystemPrompt = `${CHATBOT_SYSTEM_PROMPT}

=== CONTEXTE PATIENT ===
Nom du patient: ${patientName}
${measurementsText}

=== INSTRUCTION SPECIALE ===
Le patient vient d'ouvrir le chat. Tu dois IMMEDIATEMENT analyser ses dernieres mesures et lui donner des conseils.
Commence ta reponse par "Bonjour ${patientName} ! Voici un resume de vos dernieres mesures :" puis :
1. Liste les dernieres mesures avec les valeurs (systolique/diastolique/pouls)
2. Commente l'evolution (stable, en hausse, en baisse)
3. Identifie si certaines valeurs sont preoccupantes
4. Donne 3-4 conseils personnalises basees sur les mesures observees
5. Rappelle de consulter son medecin si necessaire

Si le patient n'a aucune mesure, encourage-le a commencer a mesurer sa tension regulierement.
Reponds en francais, avec un ton bienveillant et encourageant.`;

    // 7. Call AI with measurements context
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: measurementSystemPrompt },
      { role: 'user', content: 'Bonjour, comment sont mes constantes ?' },
    ];

    try {
      const response = await this.client.chat.completions.create({
        model: this.modelName,
        messages,
        temperature: 0.7,
        max_tokens: 1500,
      });

      const assistantContent = response.choices[0]?.message?.content || 'Desolee, je n\'ai pas pu analyser vos mesures.';
      const tokensUsed = response.usage?.total_tokens || null;
      const filtered = this.filterOutput(assistantContent);

      // Save the user trigger message
      await this.prisma.chatMessage.create({
        data: {
          conversationId: conv.id,
          role: 'USER',
          content: 'Bonjour, comment sont mes constantes ?',
        },
      });

      // Save assistant response
      const assistantMessage = await this.prisma.chatMessage.create({
        data: {
          conversationId: conv.id,
          role: 'ASSISTANT',
          content: filtered,
          tokensUsed,
        },
      });

      // Update conversation
      await this.prisma.chatConversation.update({
        where: { id: conv.id },
        data: { title: 'Analyse de mes constantes', updatedAt: new Date() },
      });

      return {
        conversation: conv,
        initialMessage: assistantMessage,
      };
    } catch (error) {
      this.logger.error(`Chatbot measurement analysis error: ${error.message}`, error.stack);

      // Save fallback messages
      await this.prisma.chatMessage.create({
        data: {
          conversationId: conv.id,
          role: 'USER',
          content: 'Bonjour, comment sont mes constantes ?',
        },
      });
      const fallbackMsg = await this.prisma.chatMessage.create({
        data: {
          conversationId: conv.id,
          role: 'ASSISTANT',
          content: 'Desolee, une erreur est survenue lors de l\'analyse de vos mesures. Veuillez reessayer ou poser une question.',
        },
      });

      return {
        conversation: conv,
        initialMessage: fallbackMsg,
      };
    }
  }

  async listConversations(patientId: string) {
    return this.prisma.chatConversation.findMany({
      where: { patientId, isActive: true },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { content: true, role: true, createdAt: true },
        },
      },
    });
  }

  async getConversation(patientId: string, conversationId: string) {
    const conv = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!conv || conv.patientId !== patientId) {
      throw new NotFoundException('Conversation introuvable');
    }
    return conv;
  }

  async sendMessage(patientId: string, conversationId: string, userMessage: string) {
    // Verify ownership
    const conv = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv || conv.patientId !== patientId) {
      throw new NotFoundException('Conversation introuvable');
    }

    // Save user message
    await this.prisma.chatMessage.create({
      data: {
        conversationId,
        role: 'USER',
        content: userMessage,
      },
    });

    // Load last 20 messages for context
    const history = await this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: { role: true, content: true },
    });

    // Build messages for DeepSeek
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: CHATBOT_SYSTEM_PROMPT },
      ...history.map((m) => ({
        role: m.role.toLowerCase() as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
    ];

    try {
      const response = await this.client.chat.completions.create({
        model: this.modelName,
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      });

      const assistantContent = response.choices[0]?.message?.content || 'Desolee, je n\'ai pas pu generer de reponse.';
      const tokensUsed = response.usage?.total_tokens || null;

      // Filter dangerous content
      const filtered = this.filterOutput(assistantContent);

      // Save assistant response
      const assistantMessage = await this.prisma.chatMessage.create({
        data: {
          conversationId,
          role: 'ASSISTANT',
          content: filtered,
          tokensUsed,
        },
      });

      // Update conversation title if first exchange
      if (history.length <= 1) {
        const title = userMessage.length > 50 ? userMessage.substring(0, 50) + '...' : userMessage;
        await this.prisma.chatConversation.update({
          where: { id: conversationId },
          data: { title, updatedAt: new Date() },
        });
      } else {
        await this.prisma.chatConversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });
      }

      return assistantMessage;
    } catch (error) {
      this.logger.error(`Chatbot error: ${error.message}`, error.stack);
      // Save error message
      return this.prisma.chatMessage.create({
        data: {
          conversationId,
          role: 'ASSISTANT',
          content: 'Desolee, une erreur est survenue. Veuillez reessayer.',
        },
      });
    }
  }

  async deleteConversation(patientId: string, conversationId: string) {
    const conv = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv || conv.patientId !== patientId) {
      throw new NotFoundException('Conversation introuvable');
    }
    return this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: { isActive: false },
    });
  }

  private filterOutput(content: string): string {
    // Remove any prescription-like content
    const forbiddenPatterns = [
      /prescri[ts]/gi,
      /ordonnance/gi,
      /posologie/gi,
      /\d+\s*mg/gi,
      /\d+\s*comprimes?/gi,
    ];
    let filtered = content;
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(filtered)) {
        filtered = filtered.replace(pattern, '[information medicale retiree]');
      }
    }
    return filtered;
  }
}
