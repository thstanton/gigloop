import { Module } from '@nestjs/common';
import { PerformanceFormatsController } from './performance-formats.controller';
import { PerformanceFormatsService } from './performance-formats.service';
import { PerformanceFormatsRepository } from './performance-formats.repository';

@Module({
  controllers: [PerformanceFormatsController],
  providers: [PerformanceFormatsService, PerformanceFormatsRepository],
})
export class PerformanceFormatsModule {}
