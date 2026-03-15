import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { MeasurementsService } from './measurements.service';
import { MeasurementsController } from './measurements.controller';
import { AiEngineModule } from '../ai-engine/ai-engine.module';
import { StorageModule } from '../storage/storage.module';
import { EmergencyModule } from '../emergency/emergency.module';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [
    AiEngineModule,
    StorageModule,
    EmergencyModule,
    GamificationModule,
    MulterModule.register({
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB for photos
    }),
  ],
  controllers: [MeasurementsController],
  providers: [MeasurementsService],
  exports: [MeasurementsService],
})
export class MeasurementsModule {}
