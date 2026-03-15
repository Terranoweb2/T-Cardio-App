import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AiOutputFilterService } from './ai-output-filter.service';
import { SYSTEM_PROMPT, PROMPT_VERSION, PROMPT_MODEL } from './prompts/system-prompt-v1';
import OpenAI from 'openai';
import * as crypto from 'crypto';

export interface PatientAiInput {
  patientId: string;
  measurements: Array<{ systolic: number; diastolic: number; pulse?: number; date: string }>;
  patientContext?: { age?: number; gender?: string; medicalStatus?: string };
  periodDays: number;
}

export interface AiAnalysisResult {
  riskLevel: string;
  confidenceScore: number;
  projections: any;
  alerts: any[];
  patientSummary: string;
  doctorSummary: string;
}

@Injectable()
export class AiEngineService {
  private readonly logger = new Logger(AiEngineService.name);
  private readonly client: OpenAI;
  private readonly modelName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly outputFilter: AiOutputFilterService,
  ) {
    this.client = new OpenAI({
      apiKey: this.configService.get<string>('DEEPSEEK_API_KEY'),
      baseURL: this.configService.get<string>('DEEPSEEK_BASE_URL', 'https://api.deepseek.com'),
    });
    this.modelName = this.configService.get<string>('DEEPSEEK_MODEL', 'deepseek-chat');
  }

  async analyzePatientData(input: PatientAiInput): Promise<AiAnalysisResult> {
    const startTime = Date.now();

    try {
      const userPrompt = this.buildPrompt(input);

      const response = await this.client.chat.completions.create({
        model: this.modelName,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('Empty AI response');

      const parsed = JSON.parse(content);

      // Filter prescriptions
      const filterResult = this.outputFilter.filterAnalysisResult(parsed);

      const result: AiAnalysisResult = {
        riskLevel: parsed.risk_level || 'FAIBLE',
        confidenceScore: parsed.confidence_score || 0.5,
        projections: parsed.projections || null,
        alerts: parsed.alerts || [],
        patientSummary: filterResult.patientSummary,
        doctorSummary: filterResult.doctorSummary,
      };

      // Log analysis
      const patientIdHash = crypto.createHash('sha256').update(input.patientId).digest('hex');

      await this.prisma.aiAnalysis.create({
        data: {
          patientId: input.patientId,
          patientIdHash,
          measurementIds: input.measurements.map((_, i) => `m_${i}`),
          inputData: input as any,
          inputMeasurementsCount: input.measurements.length,
          inputPeriodDays: input.periodDays,
          riskLevel: result.riskLevel as any,
          confidenceScore: result.confidenceScore,
          projections: result.projections,
          alerts: result.alerts,
          patientSummary: result.patientSummary,
          doctorSummary: result.doctorSummary,
          modelName: this.modelName,
          tokensUsed: response.usage?.total_tokens,
          processingTimeMs: Date.now() - startTime,
          filtered: filterResult.wasFiltered,
          filteredContent: filterResult.filteredContent.length > 0 ? filterResult.filteredContent.join(' | ') : null,
        },
      });

      return result;
    } catch (error) {
      this.logger.error(`AI analysis failed: ${error.message}`, error.stack);

      // Log error
      await this.prisma.aiAnalysis.create({
        data: {
          patientId: input.patientId,
          patientIdHash: crypto.createHash('sha256').update(input.patientId).digest('hex'),
          measurementIds: [],
          inputData: input as any,
          inputMeasurementsCount: input.measurements.length,
          inputPeriodDays: input.periodDays,
          modelName: this.modelName,
          processingTimeMs: Date.now() - startTime,
          errorMessage: error.message,
        },
      });

      // Return fallback
      return this.generateFallback(input);
    }
  }

  async getLatestAnalysis(patientId: string) {
    return this.prisma.aiAnalysis.findFirst({
      where: { patientId, errorMessage: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAnalysisHistory(patientId: string, limit: number = 10) {
    return this.prisma.aiAnalysis.findMany({
      where: { patientId, errorMessage: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private buildPrompt(input: PatientAiInput): string {
    const measurementsText = input.measurements
      .map((m) => `- ${m.date}: ${m.systolic}/${m.diastolic} mmHg${m.pulse ? `, pouls ${m.pulse} bpm` : ''}`)
      .join('\n');

    const contextText = input.patientContext ? `\nContexte patient: ${JSON.stringify(input.patientContext)}` : '';

    return `Analyse les mesures tensionnelles suivantes sur ${input.periodDays} jours:\n\nMESURES:\n${measurementsText}\n${contextText}\n\nReponds UNIQUEMENT en JSON valide selon le format defini dans tes instructions systeme.`;
  }

  private generateFallback(input: PatientAiInput): AiAnalysisResult {
    const systolics = input.measurements.map((m) => m.systolic);
    const avgSys = Math.round(systolics.reduce((a, b) => a + b, 0) / systolics.length);
    const avgDia = Math.round(input.measurements.reduce((a, b) => a + b.diastolic, 0) / input.measurements.length);

    let riskLevel = 'FAIBLE';
    if (avgSys >= 180 || avgDia >= 120) riskLevel = 'CRITIQUE';
    else if (avgSys >= 140 || avgDia >= 90) riskLevel = 'ELEVE';
    else if (avgSys >= 120 || avgDia >= 80) riskLevel = 'MODERE';

    return {
      riskLevel,
      confidenceScore: 0.3,
      projections: null,
      alerts: [],
      patientSummary: `Votre tension moyenne est de ${avgSys}/${avgDia} mmHg. Seul votre medecin peut interpreter ces resultats.`,
      doctorSummary: `Moyenne tensionnelle: ${avgSys}/${avgDia} mmHg sur ${input.periodDays} jours (${input.measurements.length} mesures). Analyse IA indisponible - fallback statistique.`,
    };
  }
}
