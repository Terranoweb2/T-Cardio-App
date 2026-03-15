import { BadgeCategory } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';

export interface BadgeSeed {
  code: string;
  name: string;
  description: string;
  category: BadgeCategory;
  xpReward: number;
  criteria: Record<string, any>;
}

export const BADGE_SEEDS: BadgeSeed[] = [
  {
    code: 'FIRST_MEASURE',
    name: 'Premiere mesure',
    description: 'Vous avez enregistre votre premiere mesure de tension',
    category: 'BADGE_MEASUREMENT',
    xpReward: 20,
    criteria: { type: 'measurement_count', count: 1 },
  },
  {
    code: '7_DAY_STREAK',
    name: '7 jours consecutifs',
    description: 'Mesures pendant 7 jours consecutifs',
    category: 'BADGE_STREAK',
    xpReward: 50,
    criteria: { type: 'streak', days: 7 },
  },
  {
    code: '30_DAY_STREAK',
    name: '30 jours consecutifs',
    description: 'Mesures pendant 30 jours consecutifs',
    category: 'BADGE_STREAK',
    xpReward: 200,
    criteria: { type: 'streak', days: 30 },
  },
  {
    code: 'FIRST_TELECONSULT',
    name: 'Premiere teleconsultation',
    description: 'Vous avez complete votre premiere teleconsultation',
    category: 'BADGE_SOCIAL',
    xpReward: 30,
    criteria: { type: 'teleconsultation_count', count: 1 },
  },
  {
    code: 'MED_ADHERENCE_90',
    name: 'Observance exemplaire',
    description: "90% d'observance medicamenteuse sur 7 jours",
    category: 'BADGE_MEDICATION',
    xpReward: 100,
    criteria: { type: 'med_adherence', percent: 90, days: 7 },
  },
  {
    code: 'RISK_IMPROVED',
    name: 'Risque ameliore',
    description: 'Votre score de risque cardiovasculaire s\'est ameliore',
    category: 'BADGE_MILESTONE',
    xpReward: 150,
    criteria: { type: 'risk_improved' },
  },
  {
    code: '10_MEASURES',
    name: '10 mesures',
    description: 'Vous avez enregistre 10 mesures',
    category: 'BADGE_MEASUREMENT',
    xpReward: 30,
    criteria: { type: 'measurement_count', count: 10 },
  },
  {
    code: '50_MEASURES',
    name: '50 mesures',
    description: 'Vous avez enregistre 50 mesures',
    category: 'BADGE_MEASUREMENT',
    xpReward: 75,
    criteria: { type: 'measurement_count', count: 50 },
  },
  {
    code: 'FIRST_MED_LOG',
    name: 'Premier suivi',
    description: 'Vous avez enregistre votre premiere prise de medicament',
    category: 'BADGE_MEDICATION',
    xpReward: 15,
    criteria: { type: 'med_log_count', count: 1 },
  },
];

/**
 * Seed all badge definitions into the database.
 * Uses upsert to create badges that don't exist yet (matched by unique code).
 */
export async function seedBadges(prisma: PrismaService): Promise<void> {
  for (const badge of BADGE_SEEDS) {
    await prisma.badge.upsert({
      where: { code: badge.code },
      create: {
        code: badge.code,
        name: badge.name,
        description: badge.description,
        category: badge.category,
        xpReward: badge.xpReward,
        criteria: badge.criteria,
      },
      update: {
        name: badge.name,
        description: badge.description,
        category: badge.category,
        xpReward: badge.xpReward,
        criteria: badge.criteria,
      },
    });
  }
}
