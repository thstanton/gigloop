import { ApiProperty } from '@nestjs/swagger';

/**
 * The stored PDF backing an issued invoice, whichever owner it has (#830, generalised by #853).
 *
 * Deliberately NOT `DocumentResponseDto`: that shape carries a required
 * `portalVisibility` verdict, which is a *booking* portal concern (ADR-0054). A series
 * invoice belongs to no single booking and is never shown on one booking's portal, so there
 * is no verdict to state; a booking invoice reaches this route only via the owner-agnostic
 * `/invoices/:id/document` path, which advertises no such opinion either.
 */
export class InvoiceDocumentResponseDto {
  @ApiProperty() id!: string;

  @ApiProperty({ description: 'ISO-8601 timestamp of when the PDF was generated and stored' })
  createdAt!: string;

  @ApiProperty({
    description:
      'Access-controlled app route (/documents/:id/download), NOT a public R2 URL. ' +
      'The client fetches it with auth to resolve the real storage URL (ADR-0059).',
    example: '/documents/d1/download',
  })
  url!: string;
}
