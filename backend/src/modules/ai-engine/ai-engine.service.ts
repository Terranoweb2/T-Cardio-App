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

    // Pre-calculate statistics for accuracy
    const systolics = input.measurements.map((m) => m.systolic);
    const diastolics = input.measurements.map((m) => m.diastolic);
    const n = systolics.length;

    const avgSys = Math.round(systolics.reduce((a, b) => a + b, 0) / n);
    const avgDia = Math.round(diastolics.reduce((a, b) => a + b, 0) / n);
    const minSys = Math.min(...systolics);
    const maxSys = Math.max(...systolics);
    const minDia = Math.min(...diastolics);
    const maxDia = Math.max(...diastolics);

    const stdSys = Math.round(Math.sqrt(systolics.reduce((sum, v) => sum + (v - avgSys) ** 2, 0) / n) * 10) / 10;
    const stdDia = Math.round(Math.sqrt(diastolics.reduce((sum, v) => sum + (v - avgDia) ** 2, 0) / n) * 10) / 10;

    const avgPP = Math.round(input.measurements.reduce((sum, m) => sum + (m.systolic - m.diastolic), 0) / n);

    const aboveThresholdSys = systolics.filter((v) => v >= 130).length;
    const aboveThresholdDia = diastolics.filter((v) => v >= 85).length;

    const pulses = input.measurements.filter((m) => m.pulse).map((m) => m.pulse!);
    const avgPulse = pulses.length > 0 ? Math.round(pulses.reduce((a, b) => a + b, 0) / pulses.length) : null;

    const contextText = input.patientContext ? `\nContexte patient: ${JSON.stringify(input.patientContext)}` : '';

    return `Analyse les mesures tensionnelles suivantes sur ${input.periodDays} jours:

MESURES (${n} mesures):
${measurementsText}

STATISTIQUES PRE-CALCULEES (utilise ces valeurs exactes dans ton analyse):
- Moyenne: ${avgSys}/${avgDia} mmHg
- Ecart-type: systolique ±${stdSys}, diastolique ±${stdDia}
- Min/Max systolique: ${minSys}-${maxSys} mmHg
- Min/Max diastolique: ${minDia}-${maxDia} mmHg
- Pression pulsee moyenne: ${avgPP} mmHg
- Mesures systolique >= 130: ${aboveThresholdSys}/${n}
- Mesures diastolique >= 85: ${aboveThresholdDia}/${n}${avgPulse ? `\n- Pouls moyen: ${avgPulse} bpm` : ''}
${contextText}

IMPORTANT: Base ton analyse sur ces statistiques exactes. Ne surestime pas le risque. 120/80 est NORMAL (FAIBLE).
Reponds UNIQUEMENT en JSON valide selon le format defini dans tes instructions systeme.`;
  }

  private generateFallback(input: PatientAiInput): AiAnalysisResult {
    const systolics = input.measurements.map((m) => m.systolic);
    const avgSys = Math.round(systolics.reduce((a, b) => a + b, 0) / systolics.length);
    const avgDia = Math.round(input.measurements.reduce((a, b) => a + b.diastolic, 0) / input.measurements.length);

    // OMS/ESH 2023 thresholds
    let riskLevel = 'FAIBLE';
    if (avgSys >= 180 || avgDia >= 120) riskLevel = 'CRITIQUE';
    else if (avgSys >= 140 || avgDia >= 90) riskLevel = 'ELEVE';
    else if (avgSys >= 130 || avgDia >= 85) riskLevel = 'MODERE';

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
