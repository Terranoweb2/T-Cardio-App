import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';
import { MessagingGateway } from './messaging.gateway';
import { AutoReplyService } from './auto-reply.service';
import { StorageModule } from '../storage/storage.module';
import { CreditModule } from '../credit/credit.module';

@Module({
  imports: [
    StorageModule,
    CreditModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [MessagingController],
  providers: [MessagingService, MessagingGateway, AutoReplyService],
  exports: [MessagingService],
})
export class MessagingModule {}
