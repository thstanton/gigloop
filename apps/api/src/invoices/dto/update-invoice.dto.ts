import type { InvoiceStatus } from '@prisma/client';

export class UpdateInvoiceDto {
  status?: InvoiceStatus;
  issueDate?: string;
  dueDate?: string | null;
  billToContactId?: string;
}
