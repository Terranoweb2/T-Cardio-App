import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SubscriptionModule } from '../../modules/subscription/subscription.module';
import { ReportsModule } from '../../modules/reports/reports.module';

@Module({
  imports: [PrismaModule, SubscriptionModule, ReportsModule],
  providers: [TasksService],
})
export class TasksModule {}
