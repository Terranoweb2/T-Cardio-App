import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PatientsService } from './patients.service';
import { PatientsController } from './patients.controller';
import { StorageModule } from '../storage/storage.module';
import { EmergencyModule } from '../emergency/emergency.module';

@Module({
  imports: [
    MulterModule.register({
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
    StorageModule,
    EmergencyModule,
  ],
  controllers: [PatientsController],
  providers: [PatientsService],
  exports: [PatientsService],
})
export class PatientsModule {}
