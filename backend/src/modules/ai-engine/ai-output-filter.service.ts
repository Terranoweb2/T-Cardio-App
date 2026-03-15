import { Injectable, Logger } from '@nestjs/common';

interface FilterResult {
  filtered: boolean;
  cleanedText: string;
  removedContent: string[];
}

@Injectable()
export class AiOutputFilterService {
  private readonly logger = new Logger(AiOutputFilterService.name);

  private readonly prescriptionPatterns = [
    /\b(prenez|prendre|prescri[ts]?|augment(?:ez|er)|diminu(?:ez|er)|arr[eê]t(?:ez|er)|dosage|posologie|mg\/jour|comprim[eé]s?|g[eé]lules?)\b/gi,
    /\b(take|prescribe|increase|decrease|stop\s+taking|dosage|milligram|tablet|capsule)\b/gi,
    /\d+\s*mg/gi,
    /\b(matin\s+et\s+soir|[23]\s+fois\s+par\s+jour|avant\s+les?\s+repas)\b/gi,
  ];

  filterOutput(text: string): FilterResult {
    let filtered = false;
    const removedContent: string[] = [];
    let cleanedText = text;

    const sentences = text.split(/(?<=[.!?])\s+/);
    const cleanedSentences = sentences.filter((sentence) => {
      for (const pattern of this.prescriptionPatterns) {
        pattern.lastIndex = 0;
        if (pattern.test(sentence)) {
          filtered = true;
          removedContent.push(sentence.trim());
          this.logger.warn(`Prescription filtree: "${sentence.trim().substring(0, 80)}..."`);
          return false;
        }
      }
      return true;
    });

    if (filtered) {
      cleanedText = cleanedSentences.join(' ');
    }

    return { filtered, cleanedText, removedContent };
  }

  filterAnalysisResult(result: { patient_summary?: string; doctor_summary?: string }) {
    const patientFilter = result.patient_summary ? this.filterOutput(result.patient_summary) : { filtered: false, cleanedText: '', removedContent: [] };
    const doctorFilter = result.doctor_summary ? this.filterOutput(result.doctor_summary) : { filtered: false, cleanedText: '', removedContent: [] };

    return {
      patientSummary: patientFilter.cleanedText,
      doctorSummary: doctorFilter.cleanedText,
      wasFiltered: patientFilter.filtered || doctorFilter.filtered,
      filteredContent: [...patientFilter.removedContent, ...doctorFilter.removedContent],
    };
  }
}
