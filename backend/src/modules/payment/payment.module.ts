import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { CreditModule } from '../credit/credit.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { PaymentService } from './payment.service';
import { MtnMomoService } from './mtn-momo.service';
import { PaymentController } from './payment.controller';

@Module({
  imports: [PrismaModule, CreditModule, SubscriptionModule],
  controllers: [PaymentController],
  providers: [PaymentService, MtnMomoService],
  exports: [PaymentService],
})
export class PaymentModule {}
