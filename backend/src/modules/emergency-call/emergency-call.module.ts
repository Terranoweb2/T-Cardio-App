import { Module } from '@nestjs/common';
import { EmergencyCallService } from './emergency-call.service';
import { EmergencyCallController } from './emergency-call.controller';
import { EmergencyModule } from '../emergency/emergency.module';
import { CreditModule } from '../credit/credit.module';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [EmergencyModule, CreditModule, SubscriptionModule],
  controllers: [EmergencyCallController],
  providers: [EmergencyCallService],
  exports: [EmergencyCallService],
})
export class EmergencyCallModule {}
