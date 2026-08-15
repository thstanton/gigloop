import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// The stored INVOICE document for a series invoice. A series has no booking and therefore no
// portal, so this deliberately omits the `portalVisibility` verdict carried by booking documents
// (ADR-0054) — the series invoice is never shown on a single booking's portal.
export class SeriesInvoiceDocumentDto {
  @ApiProperty() id!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ enum: ['INVOICE', 'CONTRACT', 'SONG_LIST', 'UPLOAD'] }) type!: string;
  @ApiProperty({
    description:
      'Access-controlled app route (e.g. /documents/:id/download), NOT a public ' +
      'R2 URL. The client fetches it with auth to resolve the real storage URL (ADR-0059).',
    example: '/documents/d1/download',
  })
  url!: string;
  @ApiPropertyOptional({ nullable: true }) invoiceId?: string | null;
}
