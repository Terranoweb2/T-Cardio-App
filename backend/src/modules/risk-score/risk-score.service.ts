import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  calculateFraminghamRisk,
  FraminghamInput,
  FraminghamResult,
} from './framingham.calculator';

@Injectable()
export class RiskScoreService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate the Framingham cardiovascular risk score for a patient.
   *
   * Gathers patient profile data, recent BP measurements, and medical
   * history, then runs the BMI-based Framingham algorithm, generates
   * French-language recommendations, and persists the result.
   */
  async calculate(patientId: string) {
    // 1. Fetch patient profile
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      throw new NotFoundException('Patient introuvable.');
    }

    // 2. Validate required data
    if (!patient.birthDate) {
      throw new BadRequestException(
        'Date de naissance manquante. Veuillez completer votre profil avant de calculer le score de risque.',
      );
    }

    if (!patient.gender || patient.gender === 'OTHER') {
      throw new BadRequestException(
        'Le sexe biologique (homme/femme) est requis pour le calcul du score de Framingham. Veuillez mettre a jour votre profil.',
      );
    }

    if (!patient.heightCm || !patient.weightKg) {
      throw new BadRequestException(
        'Taille et poids sont necessaires pour calculer l\'IMC. Veuillez completer votre profil.',
      );
    }

    // 3. Fetch latest 10 BP measurements
    const measurements = await this.prisma.bpMeasurement.findMany({
      where: { patientId },
      orderBy: { measuredAt: 'desc' },
      take: 10,
    });

    if (measurements.length === 0) {
      throw new BadRequestException(
        'Aucune mesure de pression arterielle trouvee. Veuillez enregistrer au moins une mesure avant de calculer le score de risque.',
      );
    }

    // 4. Calculate average systolic BP
    const avgSystolic = Math.round(
      measurements.reduce((sum, m) => sum + m.systolic, 0) / measurements.length,
    );

    // 5. Calculate age from birthDate
    const age = this.calculateAge(patient.birthDate);

    if (age < 20 || age > 100) {
      throw new BadRequestException(
        'Le score de Framingham est valide pour les patients ages de 20 a 100 ans.',
      );
    }

    // 6. Calculate BMI
    const heightM = patient.heightCm / 100;
    const weightKg = Number(patient.weightKg);
    const bmi = Math.round((weightKg / (heightM * heightM)) * 10) / 10;

    // 7. Determine diabetes status
    const hasDiabetes = patient.medicalStatus === 'DIABETIQUE' || this.checkMedicalHistory(patient.medicalHistory, 'diabete');

    // 8. Determine if treated for hypertension
    const isTreatedForBP = patient.medicalStatus === 'HYPERTENDU' || this.checkMedicalHistory(patient.medicalHistory, 'hypertension');

    // 9. Determine smoking status
    const isSmoker = this.checkMedicalHistory(patient.medicalHistory, 'tabac') || this.checkMedicalHistory(patient.medicalHistory, 'fumeur') || this.checkMedicalHistory(patient.medicalHistory, 'smoking');

    // 10. Build input
    const framinghamInput: FraminghamInput = {
      age,
      gender: patient.gender as 'MALE' | 'FEMALE',
      systolicBP: avgSystolic,
      isTreatedForBP,
      isSmoker,
      hasDiabetes,
      bmi,
    };

    // 11. Run Framingham calculation
    const result: FraminghamResult = calculateFraminghamRisk(framinghamInput);

    // 12. Generate French recommendations
    const recommendations = this.generateRecommendations(result, framinghamInput);

    // 13. Persist to database
    const cardioRiskScore = await this.prisma.cardioRiskScore.create({
      data: {
        patientId,
        algorithm: 'FRAMINGHAM',
        score: result.score,
        riskLevel: result.riskLevel,
        inputData: framinghamInput as any,
        factors: result.factors as any,
        recommendations: recommendations as any,
        calculatedAt: new Date(),
      },
    });

    return {
      id: cardioRiskScore.id,
      score: result.score,
      riskLevel: result.riskLevel,
      factors: result.factors,
      recommendations,
      inputData: framinghamInput,
      calculatedAt: cardioRiskScore.calculatedAt,
    };
  }

  /**
   * Get the most recent risk score for a patient.
   */
  async getLatest(patientId: string) {
    const score = await this.prisma.cardioRiskScore.findFirst({
      where: { patientId },
      orderBy: { calculatedAt: 'desc' },
    });

    if (!score) {
      throw new NotFoundException(
        'Aucun score de risque cardiovasculaire trouve pour ce patient.',
      );
    }

    return score;
  }

  /**
   * Get the history of risk scores for a patient.
   */
  async getHistory(patientId: string, limit: number = 10) {
    return this.prisma.cardioRiskScore.findMany({
      where: { patientId },
      orderBy: { calculatedAt: 'desc' },
      take: limit,
    });
  }

  // ---------- Private helpers ----------

  private calculateAge(birthDate: Date): number {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  /**
   * Check the medicalHistory JSON for a given keyword.
   * The medicalHistory field can be any JSON object; we look for boolean
   * flags, string arrays, or nested values containing the keyword.
   */
  private checkMedicalHistory(medicalHistory: any, keyword: string): boolean {
    if (!medicalHistory || typeof medicalHistory !== 'object') {
      return false;
    }

    const lowerKeyword = keyword.toLowerCase();

    // Check direct boolean flags: { smoking: true, diabete: true, ... }
    for (const key of Object.keys(medicalHistory)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes(lowerKeyword)) {
        const value = medicalHistory[key];
        if (value === true || value === 'true' || value === 'oui' || value === 'yes') {
          return true;
        }
      }
    }

    // Check if there is a conditions / antecedents array
    const arrayFields = ['conditions', 'antecedents', 'maladies', 'pathologies', 'history'];
    for (const field of arrayFields) {
      const arr = medicalHistory[field];
      if (Array.isArray(arr)) {
        if (arr.some((item: any) => typeof item === 'string' && item.toLowerCase().includes(lowerKeyword))) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Generate actionable French-language recommendations based on risk
   * factors and score.
   */
  private generateRecommendations(
    result: FraminghamResult,
    input: FraminghamInput,
  ): string[] {
    const recommendations: string[] = [];

    // General risk-level message
    switch (result.riskLevel) {
      case 'FAIBLE':
        recommendations.push(
          'Votre risque cardiovasculaire a 10 ans est faible. Continuez a maintenir un mode de vie sain.',
        );
        break;
      case 'MODERE':
        recommendations.push(
          'Votre risque cardiovasculaire a 10 ans est modere. Des modifications du mode de vie sont recommandees.',
        );
        break;
      case 'ELEVE':
        recommendations.push(
          'Votre risque cardiovasculaire a 10 ans est eleve. Consultez votre medecin pour un suivi personnalise.',
        );
        break;
      case 'CRITIQUE':
        recommendations.push(
          'Votre risque cardiovasculaire a 10 ans est critique. Une consultation medicale urgente est fortement recommandee.',
        );
        break;
    }

    // Blood pressure
    if (input.systolicBP >= 140) {
      recommendations.push(
        'Votre pression arterielle systolique moyenne est elevee. Reduisez votre consommation de sel, pratiquez une activite physique reguliere et consultez votre medecin.',
      );
    } else if (input.systolicBP >= 130) {
      recommendations.push(
        'Votre pression arterielle systolique est legerement elevee. Surveillez-la regulierement et adoptez une alimentation equilibree.',
      );
    }

    // BMI
    if (input.bmi >= 30) {
      recommendations.push(
        'Votre IMC indique une obesite. Une perte de poids, meme moderee (5-10%), peut reduire significativement votre risque cardiovasculaire.',
      );
    } else if (input.bmi >= 25) {
      recommendations.push(
        'Votre IMC indique un surpoids. Adoptez une alimentation equilibree et pratiquez au moins 150 minutes d\'activite physique par semaine.',
      );
    }

    // Smoking
    if (input.isSmoker) {
      recommendations.push(
        'Le tabagisme est l\'un des principaux facteurs de risque cardiovasculaire. L\'arret du tabac reduit significativement votre risque en quelques annees.',
      );
    }

    // Diabetes
    if (input.hasDiabetes) {
      recommendations.push(
        'Le diabete augmente votre risque cardiovasculaire. Assurez un suivi regulier de votre glycemie et respectez votre traitement.',
      );
    }

    // BP treatment
    if (input.isTreatedForBP) {
      recommendations.push(
        'Continuez a prendre regulierement votre traitement antihypertenseur et effectuez un suivi regulier aupres de votre medecin.',
      );
    }

    // Age-specific
    if (input.age >= 65) {
      recommendations.push(
        'A votre age, un suivi medical regulier est essentiel. Planifiez des visites de controle tous les 3 a 6 mois.',
      );
    }

    // General lifestyle
    recommendations.push(
      'Adoptez le regime mediterraneen : fruits, legumes, poisson, huile d\'olive. Limitez l\'alcool et pratiquez une activite physique reguliere.',
    );

    return recommendations;
  }
}
