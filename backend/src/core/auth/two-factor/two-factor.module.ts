import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { TwoFactorService } from './two-factor.service';
import { TwoFactorController } from './two-factor.controller';

@Module({
  imports: [ConfigModule],
  controllers: [TwoFactorController],
  providers: [TwoFactorService],
  exports: [TwoFactorService],
})
export class TwoFactorModule {}
