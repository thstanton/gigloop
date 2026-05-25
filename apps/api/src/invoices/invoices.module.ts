import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { InvoicesRepository } from './invoices.repository';

@Module({
  imports: [DocumentsModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicesRepository],
})
export class InvoicesModule {}
