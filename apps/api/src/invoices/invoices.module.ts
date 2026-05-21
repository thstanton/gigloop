import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { InvoicesRepository } from './invoices.repository';

@Module({
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicesRepository],
})
export class InvoicesModule {}
