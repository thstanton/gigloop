import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  DOCUMENT_PORTAL_VISIBILITY_REASONS,
  type DocumentPortalVisibilityReason,
} from '../../portal/portal-visibility';

export class DocumentPortalVisibilityDto {
  @ApiProperty({ description: 'Whether the client can currently see this document on the portal' })
  visible!: boolean;

  // Both the enum and the type come from the one declaration in portal-visibility.ts, so Scalar
  // advertises exactly the reasons `resolveDocumentVisibility` can emit (#750). Documents never
  // carry `until_published` — draft/published is a booking-level music-form gate (ADR-0054 / #533).
  @ApiPropertyOptional({
    enum: [...DOCUMENT_PORTAL_VISIBILITY_REASONS],
    description:
      'When hidden, the portal gate holding it back; absent when visible. Never ' +
      '`until_published` — that gate applies to the booking-level music form, not to documents.',
  })
  reason?: DocumentPortalVisibilityReason;
}

export class DocumentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ enum: ['INVOICE', 'CONTRACT', 'SONG_LIST', 'UPLOAD'] }) type!: string;
  @ApiProperty({
    description:
      'Access-controlled app route (e.g. /documents/:id/download), NOT a public ' +
      'R2 URL. The client fetches it with auth to resolve the real storage URL ' +
      '(ADR-0059).',
    example: '/documents/d1/download',
  })
  url!: string;
  @ApiPropertyOptional() invoiceId?: string | null;
  @ApiPropertyOptional({ description: 'Status of the associated contract; null for non-CONTRACT documents' })
  contractStatus?: string | null;
  @ApiPropertyOptional({ description: 'User-provided name for UPLOAD documents; null for system-generated' })
  name?: string | null;
  @ApiProperty({
    description:
      'True for a BookingSeries invoice document — the one Document with no owning booking, ' +
      'listed on every member booking\'s card because it covers all of them (#848). Never true ' +
      'for a document this booking actually owns.',
  })
  isSeriesInvoice!: boolean;
  @ApiProperty({
    type: DocumentPortalVisibilityDto,
    description: 'Per-document portal-visibility verdict (ADR-0054)',
  })
  portalVisibility!: DocumentPortalVisibilityDto;
}
