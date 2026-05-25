import { Injectable, NotImplementedException } from '@nestjs/common';

/**
 * Stub — PDF rendering (invoice + contract) is implemented in the next session
 * using @react-pdf/renderer. Method signatures are fixed so callers can be
 * wired up now.
 */
@Injectable()
export class PdfService {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  generateInvoicePdf(_invoiceId: string): Promise<Buffer> {
    throw new NotImplementedException('Invoice PDF generation not yet implemented');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  generateContractPdf(_bookingId: string): Promise<Buffer> {
    throw new NotImplementedException('Contract PDF generation not yet implemented');
  }
}
