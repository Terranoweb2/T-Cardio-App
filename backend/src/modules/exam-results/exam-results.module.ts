import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ExamResultsService } from './exam-results.service';
import { ExamResultsController } from './exam-results.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    StorageModule,
    MulterModule.register({ limits: { fileSize: 20 * 1024 * 1024 } }),
  ],
  controllers: [ExamResultsController],
  providers: [ExamResultsService],
  exports: [ExamResultsService],
})
export class ExamResultsModule {}
