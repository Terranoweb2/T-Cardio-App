import { Module } from '@nestjs/common';
import { MedicationsService } from './medications.service';
import { MedicationsController } from './medications.controller';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [GamificationModule],
  controllers: [MedicationsController],
  providers: [MedicationsService],
  exports: [MedicationsService],
})
export class MedicationsModule {}
