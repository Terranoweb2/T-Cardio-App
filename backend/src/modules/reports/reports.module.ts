import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { PdfGeneratorService } from './pdf-generator.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    StorageModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '365d'),
        },
      }),
    }),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, PdfGeneratorService],
  exports: [ReportsService],
})
export class ReportsModule {}
