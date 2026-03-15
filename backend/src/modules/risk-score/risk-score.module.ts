import { Module } from '@nestjs/common';
import { RiskScoreService } from './risk-score.service';
import { RiskScoreController } from './risk-score.controller';

@Module({
  controllers: [RiskScoreController],
  providers: [RiskScoreService],
  exports: [RiskScoreService],
})
export class RiskScoreModule {}
