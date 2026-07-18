import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContactResponseDto } from '../../contacts/dto/contact-response.dto';

// Wire shape of an InvoiceLineItem — mirrors `InvoiceLineItem` in
// apps/web/src/types/api.ts (no `userId`/`invoiceId`; Prisma Decimal serialises
// as string via Decimal.toJSON()).
export class InvoiceLineItemResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
  @ApiProperty() description: string;

  @ApiProperty({ description: 'Decimal serialised as string', example: '250.00' })
  amount: string;

  @ApiProperty() order: number;

  @ApiPropertyOptional({ nullable: true }) sourceBookingId: string | null;
}

// Wire shape of an Invoice — the one polymorphic entity of ADR-0063/#687.
// Mirrors `Invoice` in apps/web/src/types/api.ts so the frontend and API stay
// in lockstep. Documentation-only: the service returns the raw Prisma row and
// its shape already matches this (Decimal→string, DateTime→string via JSON
// serialisation); this DTO gives Scalar a typed schema, it does not reshape.
export class InvoiceResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;

  @ApiProperty({ enum: ['DRAFT', 'ISSUED', 'SENT', 'PAID', 'VOID'] })
  status: string;

  @ApiProperty({ description: 'Always present; false for series invoices' })
  isDeposit: boolean;

  @ApiPropertyOptional({ nullable: true }) invoiceNumber: string | null;
  @ApiPropertyOptional({ nullable: true }) issueDate: string | null;
  @ApiPropertyOptional({ nullable: true }) dueDate: string | null;
  @ApiPropertyOptional({ nullable: true }) paidAt: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Set for a booking invoice; null for a series invoice. Exactly one of bookingId/seriesId is set.',
  })
  bookingId: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Set for a series invoice; null for a booking invoice. Exactly one of bookingId/seriesId is set.',
  })
  seriesId: string | null;

  @ApiProperty() billToContactId: string;

  @ApiProperty({ type: ContactResponseDto })
  billToContact: ContactResponseDto;

  @ApiProperty({ type: [InvoiceLineItemResponseDto] })
  lineItems: InvoiceLineItemResponseDto[];
}
