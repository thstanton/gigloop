import { Module } from '@nestjs/common';
import { CommunicationsModule } from '../communications/communications.module';
import { DocumentsModule } from '../documents/documents.module';
import { ChecklistModule } from '../checklist/checklist.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { InvoicesRepository } from './invoices.repository';

@Module({
  imports: [CommunicationsModule, DocumentsModule, ChecklistModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicesRepository],
  exports: [InvoicesRepository],
})
export class InvoicesModule {}
