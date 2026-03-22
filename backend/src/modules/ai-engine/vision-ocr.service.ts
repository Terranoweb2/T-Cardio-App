import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { VISION_OCR_SYSTEM_PROMPT } from './prompts/vision-ocr-prompt';

export interface VisionOcrResult {
  isValidDevice: boolean;
  systolic: number | null;
  diastolic: number | null;
  pulse: number | null;
  confidence: 'high' | 'medium' | 'low';
  rawText: string;
  interpretation: string;
}

@Injectable()
export class VisionOcrService {
  private readonly logger = new Logger(VisionOcrService.name);
  private readonly client: OpenAI | null;
  private readonly modelName: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_VISION_API_KEY');
    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        baseURL: 'https://api.openai.com/v1',
      });
    } else {
      this.client = null;
      this.logger.warn('OPENAI_VISION_API_KEY not set — OCR will be unavailable');
    }
    this.modelName = this.configService.get<string>('OPENAI_VISION_MODEL', 'gpt-4o-mini');
  }

  async extractBpFromImage(base64Image: string): Promise<VisionOcrResult> {
    if (!this.client) {
      throw new Error('OCR service unavailable — OPENAI_VISION_API_KEY not configured');
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.modelName,
        messages: [
          {
            role: 'system',
            content: VISION_OCR_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyse cette photo de tensiometre et extrais les valeurs affichees. Reponds uniquement en JSON.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        this.logger.warn('Empty response from vision model');
        return this.errorResult('Reponse vide du modele de vision');
      }

      // Parse JSON (may be wrapped in markdown code block)
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(jsonStr);

      // Validate
      if (!parsed.is_valid_device) {
        return {
          isValidDevice: false,
          systolic: null,
          diastolic: null,
          pulse: null,
          confidence: 'low',
          rawText: parsed.raw_text || 'Image non reconnue comme un tensiometre',
          interpretation: 'Cette image ne semble pas etre un tensiometre. Veuillez prendre une photo de l\'ecran de votre appareil de mesure.',
        };
      }

      // Validate ranges
      const systolic = this.validateRange(parsed.systolic, 50, 300);
      const diastolic = this.validateRange(parsed.diastolic, 30, 200);
      const pulse = this.validateRange(parsed.pulse, 30, 250);

      // Validate systolic > diastolic
      if (systolic !== null && diastolic !== null && systolic <= diastolic) {
        this.logger.warn(`Invalid values: systolic (${systolic}) <= diastolic (${diastolic})`);
        return {
          isValidDevice: true,
          systolic: null,
          diastolic: null,
          pulse,
          confidence: 'low',
          rawText: parsed.raw_text || '',
          interpretation: 'Les valeurs extraites semblent incorrectes. Veuillez verifier et saisir manuellement.',
        };
      }

      const confidence = parsed.confidence || 'medium';
      const interpretation = this.generateInterpretation(systolic, diastolic, pulse);

      this.logger.log(`OCR result: SYS=${systolic} DIA=${diastolic} PUL=${pulse} confidence=${confidence}`);

      return {
        isValidDevice: true,
        systolic,
        diastolic,
        pulse,
        confidence,
        rawText: parsed.raw_text || '',
        interpretation,
      };
    } catch (error) {
      this.logger.error(`Vision OCR failed: ${error.message}`, error.stack);
      return this.errorResult(`Erreur lors de l'analyse: ${error.message}`);
    }
  }

  private validateRange(value: any, min: number, max: number): number | null {
    if (value === null || value === undefined) return null;
    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    if (isNaN(num) || num < min || num > max) return null;
    return num;
  }

  private generateInterpretation(systolic: number | null, diastolic: number | null, pulse: number | null): string {
    if (systolic === null || diastolic === null) {
      return 'Valeurs partiellement reconnues. Veuillez verifier les champs ci-dessous.';
    }

    let riskLevel: string;
    let message: string;

    if (systolic >= 180 || diastolic >= 120) {
      riskLevel = 'CRITIQUE';
      message = 'ATTENTION: Valeurs critiques detectees! Contactez immediatement votre medecin ou le 15.';
    } else if (systolic >= 140 || diastolic >= 90) {
      riskLevel = 'ELEVE';
      message = 'Tension elevee. Nous vous recommandons de consulter votre medecin.';
    } else if (systolic >= 120 || diastolic >= 80) {
      riskLevel = 'MODERE';
      message = 'Tension legerement elevee. Continuez a surveiller regulierement.';
    } else {
      riskLevel = 'FAIBLE';
      message = 'Tension normale. Continuez vos bonnes habitudes!';
    }

    const pulseText = pulse ? ` Pouls: ${pulse} bpm.` : '';
    return `${message} (${systolic}/${diastolic} mmHg${pulseText})`;
  }

  private errorResult(message: string): VisionOcrResult {
    return {
      isValidDevice: false,
      systolic: null,
      diastolic: null,
      pulse: null,
      confidence: 'low',
      rawText: '',
      interpretation: message,
    };
  }
}
