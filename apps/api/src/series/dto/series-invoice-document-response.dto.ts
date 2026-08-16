import { ApiProperty } from '@nestjs/swagger';

/**
 * The stored PDF backing an issued series invoice (#830).
 *
 * Deliberately NOT `DocumentResponseDto`: that shape carries a required
 * `portalVisibility` verdict, which is a *booking* portal concern (ADR-0054) —
 * a series invoice belongs to no single booking and is never shown on one
 * booking's portal, so there is no verdict to state. Advertising one here would
 * be a second, meaningless opinion.
 */
export class SeriesInvoiceDocumentResponseDto {
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
