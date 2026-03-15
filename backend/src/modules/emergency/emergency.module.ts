import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EmergencyService } from './emergency.service';
import { EmergencyGateway } from './emergency.gateway';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [EmergencyService, EmergencyGateway],
  exports: [EmergencyService, EmergencyGateway],
})
export class EmergencyModule {}
