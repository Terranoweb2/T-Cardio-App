import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { SubscriptionModule } from '../subscription/subscription.module';
import { CreditModule } from '../credit/credit.module';
import { EmailModule } from '../../core/email/email.module';

@Module({
  imports: [SubscriptionModule, CreditModule, EmailModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
