import { Module } from '@nestjs/common';
import { CommunicationsModule } from '../communications/communications.module';
import { DocumentsModule } from '../documents/documents.module';
import { ChecklistModule } from '../checklist/checklist.module';
import { ContactsModule } from '../contacts/contacts.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { InvoicesRepository } from './invoices.repository';
import { InvoiceLifecycleService } from './invoice-lifecycle.service';

@Module({
  imports: [CommunicationsModule, DocumentsModule, ChecklistModule, ContactsModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicesRepository, InvoiceLifecycleService],
  exports: [InvoicesRepository, InvoiceLifecycleService],
})
export class InvoicesModule {}
