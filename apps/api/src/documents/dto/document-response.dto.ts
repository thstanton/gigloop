import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PortalVisibilityDto {
  @ApiProperty({ description: 'Whether the client can currently see this document on the portal' })
  visible!: boolean;

  @ApiPropertyOptional({
    enum: ['until_sent', 'voided', 'not_shared', 'cancelled'],
    description: 'When hidden, the portal gate holding it back; absent when visible',
  })
  reason?: string;
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
  @ApiProperty({ type: PortalVisibilityDto, description: 'Per-document portal-visibility verdict (ADR-0054)' })
  portalVisibility!: PortalVisibilityDto;
}
