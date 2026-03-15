import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TeleconsultationService } from './teleconsultation.service';
import { TeleconsultationController } from './teleconsultation.controller';
import { TeleconsultationGateway } from './teleconsultation.gateway';
import { EmergencyModule } from '../emergency/emergency.module';
import { StorageModule } from '../storage/storage.module';
import { CreditModule } from '../credit/credit.module';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [
    EmergencyModule,
    StorageModule,
    CreditModule,
    SubscriptionModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
    MulterModule.register({
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  ],
  controllers: [TeleconsultationController],
  providers: [TeleconsultationService, TeleconsultationGateway],
  exports: [TeleconsultationService],
})
export class TeleconsultationModule {}
