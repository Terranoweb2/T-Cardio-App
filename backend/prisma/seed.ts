import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminPasswordHash = await bcrypt.hash('admin123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@tcardio.pro' },
    update: {},
    create: {
      email: 'admin@tcardio.pro',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
    },
  });
  console.log(`Admin user created: ${admin.email}`);

  // Create default AI thresholds
  const thresholds = [
    {
      name: 'Tension normale',
      category: 'RISK' as const,
      systolicMax: 119,
      diastolicMax: 79,
      actionType: 'RISK_LEVEL',
      actionParams: { riskLevel: 'FAIBLE' },
      priority: 1,
    },
    {
      name: 'Tension elevee',
      category: 'RISK' as const,
      systolicMin: 120,
      systolicMax: 139,
      diastolicMin: 80,
      diastolicMax: 89,
      actionType: 'RISK_LEVEL',
      actionParams: { riskLevel: 'MODERE' },
      priority: 2,
    },
    {
      name: 'HTA Grade 1-2',
      category: 'RISK' as const,
      systolicMin: 140,
      systolicMax: 179,
      diastolicMin: 90,
      diastolicMax: 119,
      actionType: 'RISK_LEVEL',
      actionParams: { riskLevel: 'ELEVE' },
      priority: 3,
    },
    {
      name: 'Urgence hypertensive',
      category: 'EMERGENCY' as const,
      systolicMin: 180,
      diastolicMin: 120,
      actionType: 'EMERGENCY',
      actionParams: { riskLevel: 'CRITIQUE', notifyDoctor: true },
      priority: 10,
    },
  ];

  for (const threshold of thresholds) {
    await prisma.aiThreshold.upsert({
      where: { id: threshold.name },
      update: {},
      create: threshold,
    });
  }
  console.log(`${thresholds.length} AI thresholds created`);

  // Create default prompt version
  await prisma.promptVersion.upsert({
    where: { versionName: 'v1.0.0' },
    update: {},
    create: {
      versionName: 'v1.0.0',
      versionNumber: 1,
      systemPrompt: 'T-Cardio Pro AI System Prompt v1.0.0',
      modelName: 'deepseek-chat',
      modelParameters: { temperature: 0.1, max_tokens: 2000 },
      isActive: true,
      activatedAt: new Date(),
      changeLog: 'Initial version',
    },
  });
  console.log('Default prompt version created');

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
