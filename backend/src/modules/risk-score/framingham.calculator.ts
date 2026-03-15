/**
 * Simplified Framingham Risk Score Calculator (BMI-based model)
 *
 * Implements the published Framingham BMI-based model for estimating
 * 10-year cardiovascular disease (CVD) risk when lipid panel data
 * is not available.
 *
 * Reference: D'Agostino RB Sr, Vasan RS, Pencina MJ, et al.
 * "General cardiovascular risk profile for use in primary care."
 * Circulation. 2008;117(6):743-753.
 */

export interface FraminghamInput {
  age: number;
  gender: 'MALE' | 'FEMALE';
  systolicBP: number;
  isTreatedForBP: boolean;
  isSmoker: boolean;
  hasDiabetes: boolean;
  bmi: number;
  totalCholesterol?: number;
  hdlCholesterol?: number;
}

export interface FraminghamFactor {
  name: string;
  value: string;
  impact: 'positive' | 'negative' | 'neutral';
}

export interface FraminghamResult {
  score: number; // 10-year risk percentage (0-100)
  riskLevel: 'FAIBLE' | 'MODERE' | 'ELEVE' | 'CRITIQUE';
  factors: FraminghamFactor[];
}

// ---------- Model coefficients ----------

interface GenderCoefficients {
  baselineSurvival: number;
  meanCoeff: number;
  lnAge: number;
  lnBmi: number;
  lnSbpTreated: number;
  lnSbpUntreated: number;
  smoker: number;
  diabetic: number;
}

const MALE_COEFFICIENTS: GenderCoefficients = {
  baselineSurvival: 0.88936,
  meanCoeff: 23.9802,
  lnAge: 3.11296,
  lnBmi: 0.79277,
  lnSbpTreated: 1.92672,
  lnSbpUntreated: 1.85508,
  smoker: 0.70953,
  diabetic: 0.53160,
};

const FEMALE_COEFFICIENTS: GenderCoefficients = {
  baselineSurvival: 0.95012,
  meanCoeff: 26.1931,
  lnAge: 2.72107,
  lnBmi: 0.51125,
  lnSbpTreated: 2.88267,
  lnSbpUntreated: 2.81291,
  smoker: 0.61868,
  diabetic: 0.77763,
};

// ---------- Main calculation ----------

export function calculateFraminghamRisk(input: FraminghamInput): FraminghamResult {
  const coeff =
    input.gender === 'MALE' ? MALE_COEFFICIENTS : FEMALE_COEFFICIENTS;

  // Individual terms
  const ageTerm = Math.log(input.age) * coeff.lnAge;
  const bmiTerm = Math.log(input.bmi) * coeff.lnBmi;
  const sbpTerm =
    Math.log(input.systolicBP) *
    (input.isTreatedForBP ? coeff.lnSbpTreated : coeff.lnSbpUntreated);
  const smokerTerm = input.isSmoker ? coeff.smoker : 0;
  const diabetesTerm = input.hasDiabetes ? coeff.diabetic : 0;

  const sumCoeff = ageTerm + bmiTerm + sbpTerm + smokerTerm + diabetesTerm;

  // Framingham formula: risk = 1 - S0^exp(sum - meanCoeff)
  const exponent = sumCoeff - coeff.meanCoeff;
  const riskRaw = 1 - Math.pow(coeff.baselineSurvival, Math.exp(exponent));

  // Clamp between 0 and 100 and round to one decimal
  const score = Math.round(Math.max(0, Math.min(100, riskRaw * 100)) * 10) / 10;

  // Map to risk level
  const riskLevel = mapRiskLevel(score);

  // Build factor analysis
  const factors = buildFactors(input);

  return { score, riskLevel, factors };
}

// ---------- Risk level mapping ----------

function mapRiskLevel(score: number): FraminghamResult['riskLevel'] {
  if (score < 10) return 'FAIBLE';
  if (score < 20) return 'MODERE';
  if (score < 30) return 'ELEVE';
  return 'CRITIQUE';
}

// ---------- Factor analysis ----------

function buildFactors(input: FraminghamInput): FraminghamFactor[] {
  const factors: FraminghamFactor[] = [];

  // Age
  factors.push({
    name: 'Age',
    value: `${input.age} ans`,
    impact: input.age >= 65 ? 'negative' : input.age >= 45 ? 'neutral' : 'positive',
  });

  // Gender
  factors.push({
    name: 'Sexe',
    value: input.gender === 'MALE' ? 'Homme' : 'Femme',
    impact: input.gender === 'MALE' ? 'negative' : 'positive',
  });

  // Systolic BP
  factors.push({
    name: 'Pression arterielle systolique',
    value: `${input.systolicBP} mmHg`,
    impact: input.systolicBP >= 140 ? 'negative' : input.systolicBP <= 120 ? 'positive' : 'neutral',
  });

  // BP treatment
  factors.push({
    name: 'Traitement antihypertenseur',
    value: input.isTreatedForBP ? 'Oui' : 'Non',
    impact: input.isTreatedForBP ? 'negative' : 'neutral',
  });

  // BMI
  const bmiRounded = Math.round(input.bmi * 10) / 10;
  factors.push({
    name: 'IMC',
    value: `${bmiRounded} kg/m2`,
    impact: input.bmi >= 30 ? 'negative' : input.bmi >= 25 ? 'neutral' : 'positive',
  });

  // Smoking
  factors.push({
    name: 'Tabagisme',
    value: input.isSmoker ? 'Oui' : 'Non',
    impact: input.isSmoker ? 'negative' : 'positive',
  });

  // Diabetes
  factors.push({
    name: 'Diabete',
    value: input.hasDiabetes ? 'Oui' : 'Non',
    impact: input.hasDiabetes ? 'negative' : 'positive',
  });

  return factors;
}
