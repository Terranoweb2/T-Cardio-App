import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SubscriptionModule } from '../../modules/subscription/subscription.module';

@Module({
  imports: [PrismaModule, SubscriptionModule],
  providers: [TasksService],
})
export class TasksModule {}
