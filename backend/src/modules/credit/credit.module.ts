import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { CreditService } from './credit.service';
import { CreditController } from './credit.controller';

@Module({
  imports: [PrismaModule],
  controllers: [CreditController],
  providers: [CreditService],
  exports: [CreditService],
})
export class CreditModule {}
