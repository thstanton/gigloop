import type { InvoiceStatus } from '@prisma/client';
import type { CreateLineItemDto } from './create-line-item.dto';

export class CreateInvoiceDto {
  status?: InvoiceStatus;
  isDeposit?: boolean;
  issueDate?: string;
  dueDate?: string;
  billToContactId?: string;
  lineItems?: CreateLineItemDto[];
}
