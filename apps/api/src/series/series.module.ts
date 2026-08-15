import { Module } from '@nestjs/common';
import { SeriesController } from './series.controller';
import { SeriesService } from './series.service';
import { SeriesRepository } from './series.repository';
import { InvoicesModule } from '../invoices/invoices.module';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [InvoicesModule, DocumentsModule],
  controllers: [SeriesController],
  providers: [SeriesService, SeriesRepository],
  exports: [SeriesRepository, SeriesService],
})
export class SeriesModule {}
