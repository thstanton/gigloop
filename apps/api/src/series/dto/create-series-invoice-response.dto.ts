import { ApiProperty } from '@nestjs/swagger';
import { InvoiceResponseDto } from '../../invoices/dto/invoice-response.dto';

/**
 * Wraps the newly-created series invoice with a count of member bookings billed with no fee set
 * (#850, ADR-0043 2026-08-18 amendment). Those members still get a £0.00 line — the count is a
 * heads-up so the musician can fix it before the invoice reaches a client, not a block.
 */
export class CreateSeriesInvoiceResponseDto {
  @ApiProperty({ type: InvoiceResponseDto })
  invoice: InvoiceResponseDto;

  @ApiProperty({ description: 'Count of member bookings on this invoice with no fee set (billed £0.00)' })
  feelessMemberCount: number;
}
