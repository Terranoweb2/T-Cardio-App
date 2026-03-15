import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../core/prisma/prisma.service';
import { getAutoReplySystemPrompt } from './auto-reply-prompt';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

@Injectable()
export class AutoReplyService {
  private readonly logger = new Logger(AutoReplyService.name);
  private readonly client: OpenAI;
  private readonly modelName: string;

  // Rate limiting: conversationId -> last reply timestamp
  private lastReplyTimestamps = new Map<string, number>();
  private readonly MIN_REPLY_INTERVAL_MS = 10_000; // 10 seconds

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

  /**
   * Check if AI auto-reply is active for a doctor.
   * Auto-disables if expired.
   */
  async isAutoReplyActive(doctorId: string): Promise<boolean> {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { aiAutoReplyEnabled: true, aiAutoReplyExpiresAt: true },
    });
    if (!doctor || !doctor.aiAutoReplyEnabled) return false;

    // Check expiry
    if (doctor.aiAutoReplyExpiresAt && doctor.aiAutoReplyExpiresAt < new Date()) {
      await this.prisma.doctor.update({
        where: { id: doctorId },
        data: { aiAutoReplyEnabled: false, aiAutoReplyExpiresAt: null },
      });
      this.logger.log(`Auto-reply expired for doctor ${doctorId}`);
      return false;
    }

    return true;
  }

  /**
   * Generate an AI auto-reply for a patient message.
   * Uses DeepSeek with function calling for appointment management.
   */
  async generateAutoReply(conversationId: string, patientMessage: string) {
    // Rate limiting
    const lastReply = this.lastReplyTimestamps.get(conversationId);
    if (lastReply && Date.now() - lastReply < this.MIN_REPLY_INTERVAL_MS) {
      this.logger.debug(`Rate limited: skipping auto-reply for conversation ${conversationId}`);
      return null;
    }

    // Load conversation with doctor and patient details
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        doctor: { select: { id: true, userId: true, firstName: true, lastName: true, consultationPriceXof: true, practiceAddress: true, practicePhone: true, specialty: true } },
        patient: { select: { id: true, firstName: true, lastName: true, birthDate: true } },
      },
    });
    if (!conversation) return null;

    const doc = conversation.doctor;
    // Avoid "Dr. Dr." if firstName/lastName already contains "Dr."
    const rawName = [doc.firstName, doc.lastName].filter(Boolean).join(' ').replace(/^Dr\.?\s*/i, '');
    const doctorName = `Dr. ${rawName}`;
    const patientName = [conversation.patient.firstName, conversation.patient.lastName].filter(Boolean).join(' ') || 'Patient';

    // Build doctor cabinet info
    let doctorContext = '';
    if (doc.specialty) doctorContext += `Specialite: ${doc.specialty}\n`;
    if (doc.consultationPriceXof) doctorContext += `Tarif consultation: ${doc.consultationPriceXof.toLocaleString('fr-FR')} FCFA\n`;
    if (doc.practiceAddress) doctorContext += `Adresse du cabinet: ${doc.practiceAddress}\n`;
    if (doc.practicePhone) doctorContext += `Telephone du cabinet: ${doc.practicePhone}\n`;

    // Build full patient context + agenda context in parallel
    const [patientContext, agendaContext] = await Promise.all([
      this.buildPatientContext(
        conversation.patient.id,
        patientName,
        conversation.patient.birthDate,
        doc.id,
      ),
      this.buildAgendaContext(doc.id),
    ]);

    // Load conversation history (last 20 messages for better memory)
    const history = await this.prisma.directMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { senderRole: true, content: true, isAiGenerated: true },
    });
    history.reverse();

    // Build messages for DeepSeek
    const systemPrompt = getAutoReplySystemPrompt(doctorName, patientContext, agendaContext, doctorContext);
    const currentMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({
        role: (m.senderRole === 'PATIENT' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    // Define tools for appointment management
    const tools: OpenAI.ChatCompletionTool[] = [
      {
        type: 'function',
        function: {
          name: 'get_available_slots',
          description: 'Consulter les creneaux disponibles dans mon agenda pour une date donnee.',
          parameters: {
            type: 'object',
            properties: {
              date: {
                type: 'string',
                description: 'Date au format YYYY-MM-DD (ex: 2026-03-10)',
              },
            },
            required: ['date'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'book_appointment',
          description: 'Reserver et confirmer un creneau de rendez-vous pour ce patient. Le rendez-vous sera automatiquement confirme dans mon agenda.',
          parameters: {
            type: 'object',
            properties: {
              scheduledAt: {
                type: 'string',
                description: 'Date et heure du rendez-vous au format ISO 8601 (ex: 2026-03-10T14:30:00.000Z)',
              },
              reason: {
                type: 'string',
                description: 'Motif du rendez-vous',
              },
            },
            required: ['scheduledAt'],
          },
        },
      },
    ];

    try {
      // Initial API call with tools
      let response = await this.client.chat.completions.create({
        model: this.modelName,
        messages: currentMessages,
        tools,
        temperature: 0.7,
        max_tokens: 300,
      });

      // Function calling loop (max 3 iterations)
      let iterations = 0;
      const MAX_ITERATIONS = 3;

      while (response.choices[0]?.message?.tool_calls && iterations < MAX_ITERATIONS) {
        const assistantMessage = response.choices[0].message;
        currentMessages.push(assistantMessage as any);

        for (const toolCall of assistantMessage.tool_calls!) {
          let toolResult: string;

          try {
            const args = JSON.parse(toolCall.function.arguments);

            if (toolCall.function.name === 'get_available_slots') {
              toolResult = await this.executeGetAvailableSlots(
                conversation.doctor.id,
                args.date,
              );
            } else if (toolCall.function.name === 'book_appointment') {
              toolResult = await this.executeBookAppointment(
                conversation.patient.id,
                conversation.doctor.id,
                args,
              );
            } else {
              toolResult = JSON.stringify({ error: 'Outil inconnu' });
            }
          } catch (error) {
            toolResult = JSON.stringify({ error: error.message });
          }

          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolResult,
          } as any);
        }

        // Follow-up API call with tool results
        response = await this.client.chat.completions.create({
          model: this.modelName,
          messages: currentMessages,
          tools,
          temperature: 0.7,
          max_tokens: 300,
        });

        iterations++;
      }

      let aiContent = response.choices[0]?.message?.content;
      if (!aiContent) return null;

      // Filter dangerous content
      aiContent = this.filterOutput(aiContent);

      // Save as DirectMessage with isAiGenerated: true
      const aiMessage = await this.prisma.directMessage.create({
        data: {
          conversationId,
          senderId: conversation.doctor.userId,
          senderRole: 'MEDECIN',
          content: aiContent,
          isAiGenerated: true,
        },
      });

      // Update conversation lastMessageAt
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      });

      // Update rate limiter
      this.lastReplyTimestamps.set(conversationId, Date.now());

      this.logger.log(`AI auto-reply sent in conversation ${conversationId} (${aiContent.length} chars, ${iterations} tool iterations)`);
      return aiMessage;
    } catch (error) {
      this.logger.error(`AI auto-reply error: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Toggle AI auto-reply for a doctor.
   */
  async toggleAutoReply(doctorId: string, enabled: boolean, durationMinutes?: number) {
    const data: any = {
      aiAutoReplyEnabled: enabled,
      aiAutoReplyExpiresAt: null,
    };

    if (enabled && durationMinutes && durationMinutes > 0) {
      data.aiAutoReplyExpiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
    }

    const doctor = await this.prisma.doctor.update({
      where: { id: doctorId },
      data,
      select: {
        aiAutoReplyEnabled: true,
        aiAutoReplyExpiresAt: true,
      },
    });

    this.logger.log(`Auto-reply ${enabled ? 'enabled' : 'disabled'} for doctor ${doctorId}${durationMinutes ? ` (${durationMinutes} min)` : ''}`);
    return doctor;
  }

  /**
   * Get the current auto-reply status for a doctor.
   */
  async getAutoReplyStatus(doctorId: string) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { aiAutoReplyEnabled: true, aiAutoReplyExpiresAt: true },
    });
    if (!doctor) return { enabled: false, expiresAt: null };

    // Check if expired
    if (doctor.aiAutoReplyEnabled && doctor.aiAutoReplyExpiresAt && doctor.aiAutoReplyExpiresAt < new Date()) {
      await this.prisma.doctor.update({
        where: { id: doctorId },
        data: { aiAutoReplyEnabled: false, aiAutoReplyExpiresAt: null },
      });
      return { enabled: false, expiresAt: null };
    }

    return {
      enabled: doctor.aiAutoReplyEnabled,
      expiresAt: doctor.aiAutoReplyExpiresAt,
    };
  }

  // ==================== PATIENT CONTEXT ====================

  /**
   * Build comprehensive patient medical context for the AI.
   */
  private async buildPatientContext(
    patientId: string,
    patientName: string,
    birthDate: Date | null,
    doctorId: string,
  ): Promise<string> {
    const since30d = new Date();
    since30d.setDate(since30d.getDate() - 30);

    // Load all data in parallel for performance
    const [
      patientDetails,
      activeMedications,
      recentPrescriptions,
      recentNotes,
      recentExams,
      upcomingAppointments,
      cardioRiskScore,
      activeGoals,
      measurements,
      latestAnalysis,
    ] = await Promise.all([
      // 1. Demographics
      this.prisma.patient.findUnique({
        where: { id: patientId },
        select: {
          gender: true,
          heightCm: true,
          weightKg: true,
          medicalStatus: true,
          medicalHistory: true,
          allergies: true,
          medications: true,
        },
      }),
      // 2. Active medications (Medication model)
      this.prisma.medication.findMany({
        where: { patientId, isActive: true },
        select: { name: true, dosage: true, frequency: true },
        take: 10,
      }),
      // 3. Recent prescriptions from this doctor
      this.prisma.prescription.findMany({
        where: { patientId, doctorId },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { medications: true, notes: true, createdAt: true },
      }),
      // 4. Recent medical notes from this doctor
      this.prisma.medicalNote.findMany({
        where: { patientId, doctorId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { noteType: true, content: true, createdAt: true },
      }),
      // 5. Recent exam results
      this.prisma.examResult.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { type: true, title: true, notes: true, doctorComment: true, createdAt: true },
      }),
      // 6. Upcoming appointments with this doctor
      this.prisma.appointment.findMany({
        where: {
          patientId,
          doctorId,
          scheduledAt: { gte: new Date() },
          status: { in: ['APPT_PENDING', 'CONFIRMED'] as any },
        },
        orderBy: { scheduledAt: 'asc' },
        take: 3,
        select: { scheduledAt: true, status: true, reason: true },
      }),
      // 7. Latest cardio risk score
      this.prisma.cardioRiskScore.findFirst({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        select: { score: true, riskLevel: true, factors: true, recommendations: true },
      }),
      // 8. Active health goals
      this.prisma.healthGoal.findMany({
        where: { patientId, status: 'GOAL_ACTIVE' as any },
        take: 3,
        select: { type: true, title: true, targetValue: true, currentValue: true, unit: true },
      }),
      // 9. BP measurements (last 30 days)
      this.prisma.bpMeasurement.findMany({
        where: { patientId, measuredAt: { gte: since30d } },
        orderBy: { measuredAt: 'desc' },
        take: 10,
      }),
      // 10. Latest AI analysis
      this.prisma.aiAnalysis.findFirst({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        select: { patientSummary: true, doctorSummary: true, riskLevel: true },
      }),
    ]);

    // === Build context string ===
    let context = `Nom: ${patientName}`;

    // Age
    if (birthDate) {
      const age = Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      context += ` | Age: ${age} ans`;
    }

    // Demographics
    if (patientDetails) {
      if (patientDetails.gender) context += ` | Sexe: ${patientDetails.gender === 'MALE' ? 'Homme' : patientDetails.gender === 'FEMALE' ? 'Femme' : 'Autre'}`;
      if (patientDetails.heightCm && patientDetails.weightKg) {
        const bmi = (Number(patientDetails.weightKg) / ((patientDetails.heightCm / 100) ** 2)).toFixed(1);
        context += ` | ${patientDetails.heightCm}cm, ${patientDetails.weightKg}kg (IMC ${bmi})`;
      }
      context += '\n';

      // Medical status
      const statusLabels: Record<string, string> = {
        STANDARD: 'Standard',
        HYPERTENDU: 'Hypertendu',
        POST_AVC: 'Post-AVC',
        DIABETIQUE: 'Diabetique',
        AUTRE: 'Autre',
      };
      context += `Statut: ${statusLabels[patientDetails.medicalStatus] || patientDetails.medicalStatus}\n`;

      // Allergies
      const allergies = patientDetails.allergies as any;
      if (allergies && Array.isArray(allergies) && allergies.length > 0) {
        context += `Allergies: ${allergies.join(', ')}\n`;
      }

      // Medical history
      const history = patientDetails.medicalHistory as any;
      if (history && typeof history === 'object') {
        const entries = Array.isArray(history) ? history : Object.entries(history).map(([k, v]) => `${k}: ${v}`);
        if (entries.length > 0) {
          context += `Antecedents: ${entries.slice(0, 5).join(', ')}\n`;
        }
      }
    }

    // Active medications
    if (activeMedications.length > 0) {
      context += '\nTraitement en cours:\n';
      for (const med of activeMedications) {
        context += `- ${med.name}`;
        if (med.dosage) context += ` ${med.dosage}`;
        if (med.frequency) context += ` (${med.frequency})`;
        context += '\n';
      }
    }

    // BP Measurements
    if (measurements.length > 0) {
      context += '\nTension arterielle (30 derniers jours):\n';
      for (const m of measurements) {
        const date = new Date(m.measuredAt).toLocaleDateString('fr-FR', {
          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
        });
        context += `- ${date}: ${m.systolic}/${m.diastolic}`;
        if (m.pulse) context += `, pouls ${m.pulse}`;
        context += ` (${m.riskLevel})\n`;
      }
      const avgSys = Math.round(measurements.reduce((a, m) => a + m.systolic, 0) / measurements.length);
      const avgDia = Math.round(measurements.reduce((a, m) => a + m.diastolic, 0) / measurements.length);
      context += `Moyennes: ${avgSys}/${avgDia} mmHg\n`;
    } else {
      context += '\nPas de mesure de tension ces 30 derniers jours.\n';
    }

    // Latest analysis
    if (latestAnalysis) {
      context += `\nAnalyse recente: Risque ${latestAnalysis.riskLevel}`;
      if (latestAnalysis.doctorSummary) {
        context += ` — ${latestAnalysis.doctorSummary.substring(0, 200)}`;
      } else if (latestAnalysis.patientSummary) {
        context += ` — ${latestAnalysis.patientSummary.substring(0, 200)}`;
      }
      context += '\n';
    }

    // Cardio risk score
    if (cardioRiskScore) {
      context += `Score risque cardiovasculaire: ${cardioRiskScore.score}% (${cardioRiskScore.riskLevel})`;
      const factors = cardioRiskScore.factors as any;
      if (factors && Array.isArray(factors)) {
        context += ` — Facteurs: ${factors.slice(0, 4).join(', ')}`;
      }
      context += '\n';
    }

    // Recent medical notes
    if (recentNotes.length > 0) {
      context += '\nNotes medicales recentes:\n';
      for (const note of recentNotes) {
        const date = new Date(note.createdAt).toLocaleDateString('fr-FR');
        context += `- [${date}] ${note.noteType}: ${note.content.substring(0, 100)}${note.content.length > 100 ? '...' : ''}\n`;
      }
    }

    // Recent prescriptions
    if (recentPrescriptions.length > 0) {
      context += '\nDernieres prescriptions:\n';
      for (const rx of recentPrescriptions) {
        const date = new Date(rx.createdAt).toLocaleDateString('fr-FR');
        const meds = rx.medications as any;
        const medList = Array.isArray(meds) ? meds.map((m: any) => m.name || m).join(', ') : 'details en dossier';
        context += `- [${date}] ${medList}`;
        if (rx.notes) context += ` — ${rx.notes.substring(0, 60)}`;
        context += '\n';
      }
    }

    // Exam results
    if (recentExams.length > 0) {
      context += '\nExamens recents:\n';
      for (const exam of recentExams) {
        const date = new Date(exam.createdAt).toLocaleDateString('fr-FR');
        context += `- [${date}] ${exam.type}${exam.title ? ': ' + exam.title : ''}`;
        if (exam.doctorComment) context += ` — ${exam.doctorComment.substring(0, 80)}`;
        context += '\n';
      }
    }

    // Upcoming appointments
    if (upcomingAppointments.length > 0) {
      context += '\nProchains rendez-vous:\n';
      for (const appt of upcomingAppointments) {
        const date = new Date(appt.scheduledAt).toLocaleDateString('fr-FR', {
          weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit',
        });
        context += `- ${date} (${appt.status === 'CONFIRMED' ? 'confirme' : 'en attente'})`;
        if (appt.reason) context += ` — ${appt.reason}`;
        context += '\n';
      }
    }

    // Health goals
    if (activeGoals.length > 0) {
      context += '\nObjectifs de sante actifs:\n';
      for (const goal of activeGoals) {
        context += `- ${goal.title}: ${goal.currentValue}/${goal.targetValue}`;
        if (goal.unit) context += ` ${goal.unit}`;
        context += '\n';
      }
    }

    // Truncate if too long
    if (context.length > 3500) {
      context = context.substring(0, 3500) + '\n[...suite du dossier disponible en consultation]';
    }

    return context;
  }

  // ==================== AGENDA CONTEXT ====================

  /**
   * Build doctor's weekly agenda context.
   */
  private async buildAgendaContext(doctorId: string): Promise<string> {
    const [availabilities, unavailabilities] = await Promise.all([
      this.prisma.doctorAvailability.findMany({
        where: { doctorId, isActive: true },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      }),
      this.prisma.doctorUnavailability.findMany({
        where: {
          doctorId,
          date: { gte: new Date() },
        },
        orderBy: { date: 'asc' },
        take: 7,
      }),
    ]);

    if (availabilities.length === 0) {
      return 'Agenda non configure.';
    }

    // Group by day of week
    let agenda = '';
    for (let day = 1; day <= 6; day++) {
      // Monday to Saturday
      const daySlots = availabilities.filter((a) => a.dayOfWeek === day);
      const dayName = DAY_NAMES[day];
      if (daySlots.length === 0) {
        agenda += `${dayName}: repos\n`;
      } else {
        const slots = daySlots.map((s) => `${s.startTime}-${s.endTime}`).join(', ');
        const duration = daySlots[0].slotDurationMin;
        agenda += `${dayName}: ${slots} (creneaux ${duration}min)\n`;
      }
    }
    // Sunday
    const sundaySlots = availabilities.filter((a) => a.dayOfWeek === 0);
    if (sundaySlots.length === 0) {
      agenda += `Dimanche: repos\n`;
    } else {
      const slots = sundaySlots.map((s) => `${s.startTime}-${s.endTime}`).join(', ');
      agenda += `Dimanche: ${slots}\n`;
    }

    // Unavailabilities
    if (unavailabilities.length > 0) {
      agenda += '\nIndisponibilites prevues:\n';
      for (const u of unavailabilities) {
        const date = new Date(u.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        if (!u.startTime) {
          agenda += `- ${date}: journee entiere`;
        } else {
          agenda += `- ${date}: ${u.startTime}-${u.endTime || '?'}`;
        }
        if (u.reason) agenda += ` (${u.reason})`;
        agenda += '\n';
      }
    }

    // Add today's date for reference
    const today = new Date();
    agenda += `\nAujourd'hui: ${today.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}`;

    return agenda;
  }

  // ==================== TOOL EXECUTION ====================

  /**
   * Get available appointment slots for a specific date.
   * Reproduces DoctorsService.getAvailableSlots logic.
   */
  private async executeGetAvailableSlots(doctorId: string, date: string): Promise<string> {
    try {
      const targetDate = new Date(date);
      if (isNaN(targetDate.getTime())) {
        return JSON.stringify({ error: 'Date invalide', slots: [] });
      }

      // Don't allow past dates
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (targetDate < today) {
        return JSON.stringify({ error: 'Cette date est passee', slots: [] });
      }

      const dayOfWeek = targetDate.getDay();

      const availabilities = await this.prisma.doctorAvailability.findMany({
        where: { doctorId, dayOfWeek, isActive: true },
        orderBy: { startTime: 'asc' },
      });

      if (availabilities.length === 0) {
        const dayName = DAY_NAMES[dayOfWeek];
        return JSON.stringify({
          date,
          slots: [],
          message: `Pas de consultations prevues le ${dayName}.`,
        });
      }

      // Check for unavailability on that date
      const unavailability = await this.prisma.doctorUnavailability.findFirst({
        where: { doctorId, date: targetDate },
      });

      if (unavailability && !unavailability.startTime) {
        return JSON.stringify({
          date,
          slots: [],
          message: `Indisponible ce jour${unavailability.reason ? ' (' + unavailability.reason + ')' : ''}.`,
        });
      }

      // Get existing bookings for that day
      const dayStart = new Date(targetDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(targetDate);
      dayEnd.setHours(23, 59, 59, 999);

      const [existingAppointments, existingConsultations] = await Promise.all([
        this.prisma.appointment.findMany({
          where: {
            doctorId,
            scheduledAt: { gte: dayStart, lte: dayEnd },
            status: { in: ['APPT_PENDING', 'CONFIRMED'] as any },
          },
          select: { scheduledAt: true, durationMin: true },
        }),
        this.prisma.teleconsultation.findMany({
          where: {
            doctorId,
            scheduledAt: { gte: dayStart, lte: dayEnd },
            status: { in: ['PLANNED', 'ACTIVE'] as any },
          },
          select: { scheduledAt: true, durationMinutes: true },
        }),
      ]);

      // Generate available slots
      const slots: Array<{ startTime: string; endTime: string }> = [];
      const now = new Date();

      for (const avail of availabilities) {
        const [startH, startM] = avail.startTime.split(':').map(Number);
        const [endH, endM] = avail.endTime.split(':').map(Number);
        const slotDuration = avail.slotDurationMin;

        let currentMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        while (currentMinutes + slotDuration <= endMinutes) {
          const slotStartH = Math.floor(currentMinutes / 60);
          const slotStartM = currentMinutes % 60;
          const slotEndMinutes = currentMinutes + slotDuration;
          const slotEndH = Math.floor(slotEndMinutes / 60);
          const slotEndM = slotEndMinutes % 60;

          const slotStart = `${String(slotStartH).padStart(2, '0')}:${String(slotStartM).padStart(2, '0')}`;
          const slotEnd = `${String(slotEndH).padStart(2, '0')}:${String(slotEndM).padStart(2, '0')}`;

          // Check partial unavailability
          if (unavailability?.startTime && unavailability?.endTime) {
            if (slotStart < unavailability.endTime && slotEnd > unavailability.startTime) {
              currentMinutes += slotDuration;
              continue;
            }
          }

          // Check if slot is in the past (for today)
          const slotDateTime = new Date(targetDate);
          slotDateTime.setHours(slotStartH, slotStartM, 0, 0);
          if (slotDateTime <= now) {
            currentMinutes += slotDuration;
            continue;
          }

          // Check conflicts
          const sStart = slotDateTime.getTime();
          const sEnd = sStart + slotDuration * 60 * 1000;

          const hasConflict = existingAppointments.some((a) => {
            const aStart = new Date(a.scheduledAt).getTime();
            const aEnd = aStart + (a.durationMin || 30) * 60 * 1000;
            return sStart < aEnd && sEnd > aStart;
          }) || existingConsultations.some((c) => {
            if (!c.scheduledAt) return false;
            const cStart = new Date(c.scheduledAt).getTime();
            const cEnd = cStart + (c.durationMinutes || 15) * 60 * 1000;
            return sStart < cEnd && sEnd > cStart;
          });

          if (!hasConflict) {
            slots.push({ startTime: slotStart, endTime: slotEnd });
          }

          currentMinutes += slotDuration;
        }
      }

      const dateFormatted = targetDate.toLocaleDateString('fr-FR', {
        weekday: 'long', day: '2-digit', month: 'long',
      });

      return JSON.stringify({
        date,
        dateFormatted,
        slots,
        message: slots.length > 0
          ? `${slots.length} creneau(x) disponible(s) le ${dateFormatted}.`
          : `Aucun creneau disponible le ${dateFormatted}.`,
      });
    } catch (error) {
      this.logger.error(`executeGetAvailableSlots error: ${error.message}`);
      return JSON.stringify({ error: 'Erreur lors de la consultation de l\'agenda', slots: [] });
    }
  }

  /**
   * Book an appointment for the patient.
   * Reproduces AppointmentsService.book logic (simplified, without push).
   */
  private async executeBookAppointment(
    patientId: string,
    doctorId: string,
    args: { scheduledAt: string; reason?: string },
  ): Promise<string> {
    try {
      const scheduledAt = new Date(args.scheduledAt);
      if (isNaN(scheduledAt.getTime())) {
        return JSON.stringify({ success: false, error: 'Date invalide' });
      }

      // Must be in the future
      if (scheduledAt <= new Date()) {
        return JSON.stringify({ success: false, error: 'La date doit etre dans le futur' });
      }

      const durationMin = 30;

      // Check availability
      const dayOfWeek = scheduledAt.getUTCDay();
      const slotTime = `${String(scheduledAt.getUTCHours()).padStart(2, '0')}:${String(scheduledAt.getUTCMinutes()).padStart(2, '0')}`;
      const slotEndMinutes = scheduledAt.getUTCHours() * 60 + scheduledAt.getUTCMinutes() + durationMin;
      const slotEndTime = `${String(Math.floor(slotEndMinutes / 60)).padStart(2, '0')}:${String(slotEndMinutes % 60).padStart(2, '0')}`;

      const availabilities = await this.prisma.doctorAvailability.findMany({
        where: { doctorId, dayOfWeek, isActive: true },
      });

      const isWithinAvailability = availabilities.some(
        (a) => slotTime >= a.startTime && slotEndTime <= a.endTime,
      );

      if (!isWithinAvailability) {
        return JSON.stringify({ success: false, error: 'Ce creneau n\'est pas dans mes heures de consultation' });
      }

      // Check unavailability
      const dateOnly = new Date(Date.UTC(scheduledAt.getUTCFullYear(), scheduledAt.getUTCMonth(), scheduledAt.getUTCDate()));
      const unavailability = await this.prisma.doctorUnavailability.findFirst({
        where: { doctorId, date: dateOnly },
      });

      if (unavailability) {
        if (!unavailability.startTime) {
          return JSON.stringify({ success: false, error: 'Je suis indisponible ce jour-la' });
        }
        if (unavailability.startTime && unavailability.endTime &&
            slotTime < unavailability.endTime && slotEndTime > unavailability.startTime) {
          return JSON.stringify({ success: false, error: 'Ce creneau tombe pendant une indisponibilite' });
        }
      }

      // Check appointment conflicts
      const dayStart = new Date(scheduledAt);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(scheduledAt);
      dayEnd.setUTCHours(23, 59, 59, 999);

      const [existingAppts, existingTelec] = await Promise.all([
        this.prisma.appointment.findMany({
          where: {
            doctorId,
            status: { in: ['APPT_PENDING', 'CONFIRMED'] as any },
            scheduledAt: { gte: dayStart, lte: dayEnd },
          },
          select: { scheduledAt: true, durationMin: true },
        }),
        this.prisma.teleconsultation.findMany({
          where: {
            doctorId,
            status: { in: ['PLANNED', 'ACTIVE'] as any },
            scheduledAt: { gte: dayStart, lte: dayEnd },
          },
          select: { scheduledAt: true, durationMinutes: true },
        }),
      ]);

      const slotStart = scheduledAt.getTime();
      const slotEnd = slotStart + durationMin * 60 * 1000;

      for (const appt of existingAppts) {
        const aStart = new Date(appt.scheduledAt).getTime();
        const aEnd = aStart + (appt.durationMin || 30) * 60 * 1000;
        if (slotStart < aEnd && slotEnd > aStart) {
          return JSON.stringify({ success: false, error: 'Ce creneau est deja pris' });
        }
      }

      for (const tc of existingTelec) {
        if (!tc.scheduledAt) continue;
        const cStart = new Date(tc.scheduledAt).getTime();
        const cEnd = cStart + (tc.durationMinutes || 15) * 60 * 1000;
        if (slotStart < cEnd && slotEnd > cStart) {
          return JSON.stringify({ success: false, error: 'Ce creneau est deja pris pour une teleconsultation' });
        }
      }

      // Create a Teleconsultation linked to the appointment (auto-confirm)
      const teleconsultation = await this.prisma.teleconsultation.create({
        data: {
          patientId,
          doctorId,
          scheduledAt,
          durationMinutes: durationMin,
          reason: args.reason || null,
          status: 'PLANNED',
          rtcRoomId: uuidv4(),
        },
      });

      // Create the appointment as CONFIRMED (auto-confirmed by doctor's AI)
      const appointment = await this.prisma.appointment.create({
        data: {
          patientId,
          doctorId,
          scheduledAt,
          durationMin,
          status: 'CONFIRMED',
          reason: args.reason || null,
          teleconsultationId: teleconsultation.id,
        },
      });

      const dateFormatted = scheduledAt.toLocaleDateString('fr-FR', {
        weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit',
      });

      this.logger.log(`AI booked & confirmed appointment ${appointment.id} for patient ${patientId} with doctor ${doctorId} at ${scheduledAt.toISOString()}`);

      return JSON.stringify({
        success: true,
        appointmentId: appointment.id,
        scheduledAt: scheduledAt.toISOString(),
        dateFormatted,
        message: `Rendez-vous confirme pour le ${dateFormatted}.`,
      });
    } catch (error) {
      this.logger.error(`executeBookAppointment error: ${error.message}`);
      return JSON.stringify({ success: false, error: 'Erreur lors de la reservation' });
    }
  }

  // ==================== OUTPUT FILTER ====================

  /**
   * Filter dangerous medical content AND AI identity leaks from output.
   */
  private filterOutput(content: string): string {
    // Medical content filters
    const medicalPatterns = [
      /prescri[ts]/gi,
      /ordonnance/gi,
      /posologie/gi,
      /\d+\s*mg/gi,
      /\d+\s*comprimes?/gi,
    ];

    // AI identity leak filters — each with its own replacement to keep grammar correct
    const identityReplacements: Array<{ pattern: RegExp; replacement: string }> = [
      { pattern: /je suis (?:une? )?(?:IA|intelligence artificielle)/gi, replacement: 'je suis votre medecin' },
      { pattern: /je suis (?:un )?(?:robot|programme|assistant|chatbot|bot)/gi, replacement: 'je suis votre medecin' },
      { pattern: /(?:l'|une? |mon |votre |cet(?:te)? )?(?:IA|intelligence artificielle)/gi, replacement: '' },
      { pattern: /(?:l'|un |mon |votre |cet(?:te)? )?assistant (?:virtuel|IA|numerique|medical automatise|medical)/gi, replacement: '' },
      { pattern: /reponse (?:automatique|automatisee|generee)/gi, replacement: 'reponse' },
      { pattern: /en tant qu'(?:IA|assistant|programme)/gi, replacement: 'en tant que medecin' },
      { pattern: /genere (?:automatiquement|par une? IA)/gi, replacement: '' },
      { pattern: /\b(?:chatbot|robot|automate)\b/gi, replacement: 'medecin' },
    ];

    let filtered = content;

    for (const pattern of medicalPatterns) {
      if (pattern.test(filtered)) {
        filtered = filtered.replace(pattern, '[a discuter en consultation]');
      }
    }

    for (const { pattern, replacement } of identityReplacements) {
      if (pattern.test(filtered)) {
        filtered = filtered.replace(pattern, replacement);
        this.logger.warn(`AI identity leak filtered in output`);
      }
    }

    // Clean up any double spaces or empty artifacts left by replacements
    filtered = filtered.replace(/\s{2,}/g, ' ').trim();

    return filtered;
  }
}
