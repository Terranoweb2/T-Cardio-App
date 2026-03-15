import { Module } from '@nestjs/common';
import { AiEngineService } from './ai-engine.service';
import { AiEngineController } from './ai-engine.controller';
import { AiOutputFilterService } from './ai-output-filter.service';
import { VisionOcrService } from './vision-ocr.service';

@Module({
  controllers: [AiEngineController],
  providers: [AiEngineService, AiOutputFilterService, VisionOcrService],
  exports: [AiEngineService, VisionOcrService],
})
export class AiEngineModule {}
