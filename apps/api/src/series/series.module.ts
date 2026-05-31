import { Module } from '@nestjs/common';
import { SeriesController } from './series.controller';
import { SeriesService } from './series.service';
import { SeriesRepository } from './series.repository';
import { InvoicesModule } from '../invoices/invoices.module';
import { DocumentsModule } from '../documents/documents.module';
import { CommunicationsModule } from '../communications/communications.module';

@Module({
  imports: [InvoicesModule, DocumentsModule, CommunicationsModule],
  controllers: [SeriesController],
  providers: [SeriesService, SeriesRepository],
  exports: [SeriesRepository],
})
export class SeriesModule {}
