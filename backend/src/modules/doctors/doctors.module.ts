import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { DoctorsService } from './doctors.service';
import { DoctorsController } from './doctors.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    MulterModule.register({
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
    StorageModule,
  ],
  controllers: [DoctorsController],
  providers: [DoctorsService],
  exports: [DoctorsService],
})
export class DoctorsModule {}
