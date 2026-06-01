import { Module } from '@nestjs/common';
import { SeriesController } from './series.controller';
import { SeriesService } from './series.service';
import { SeriesRepository } from './series.repository';

@Module({
  controllers: [SeriesController],
  providers: [SeriesService, SeriesRepository],
  exports: [SeriesRepository],
})
export class SeriesModule {}
