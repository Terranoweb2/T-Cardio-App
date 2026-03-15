import { Global, Module } from '@nestjs/common';
import { DoctorWalletService } from './doctor-wallet.service';
import { DoctorWalletController } from './doctor-wallet.controller';

@Global()
@Module({
  controllers: [DoctorWalletController],
  providers: [DoctorWalletService],
  exports: [DoctorWalletService],
})
export class DoctorWalletModule {}
