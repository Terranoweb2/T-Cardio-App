import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { GamificationController } from './gamification.controller';
import { PrismaService } from '../../core/prisma/prisma.service';
import { seedBadges } from './badges.seed';

@Module({
  controllers: [GamificationController],
  providers: [GamificationService],
  exports: [GamificationService],
})
export class GamificationModule implements OnModuleInit {
  private readonly logger = new Logger(GamificationModule.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await seedBadges(this.prisma);
      this.logger.log('Badge definitions seeded successfully');
    } catch (err) {
      this.logger.warn(`Failed to seed badges: ${err.message}`);
    }
  }
}
