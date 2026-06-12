import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DocumentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ enum: ['INVOICE', 'CONTRACT', 'SONG_LIST', 'UPLOAD'] }) type!: string;
  @ApiProperty() url!: string;
  @ApiPropertyOptional() invoiceId?: string | null;
  @ApiPropertyOptional({ description: 'Status of the associated contract; null for non-CONTRACT documents' })
  contractStatus?: string | null;
  @ApiPropertyOptional({ description: 'User-provided name for UPLOAD documents; null for system-generated' })
  name?: string | null;
}
