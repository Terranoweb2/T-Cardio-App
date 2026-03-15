import { Module } from '@nestjs/common';
import { PrescriptionsService } from './prescriptions.service';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionPdfService } from './prescription-pdf.service';
import { StorageModule } from '../storage/storage.module';
import { DoctorsModule } from '../doctors/doctors.module';

@Module({
  imports: [StorageModule, DoctorsModule],
  controllers: [PrescriptionsController],
  providers: [PrescriptionsService, PrescriptionPdfService],
  exports: [PrescriptionsService],
})
export class PrescriptionsModule {}
