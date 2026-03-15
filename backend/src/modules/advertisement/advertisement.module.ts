import { Module } from '@nestjs/common';
import { AdvertisementService } from './advertisement.service';
import { AdvertisementController } from './advertisement.controller';

@Module({
  controllers: [AdvertisementController],
  providers: [AdvertisementService],
  exports: [AdvertisementService],
})
export class AdvertisementModule {}
