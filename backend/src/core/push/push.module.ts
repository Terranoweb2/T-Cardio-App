import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PushService } from './push.service';
import { PushController } from './push.controller';
import { CallNotificationGateway } from './call-notification.gateway';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [PushController],
  providers: [PushService, CallNotificationGateway],
  exports: [PushService, CallNotificationGateway],
})
export class PushModule {}
