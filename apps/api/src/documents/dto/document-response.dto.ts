import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DocumentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ enum: ['INVOICE', 'CONTRACT', 'SONG_LIST'] }) type!: string;
  @ApiProperty() url!: string;
  @ApiPropertyOptional() invoiceId?: string | null;
  @ApiPropertyOptional({ description: 'Status of the associated contract; null for non-CONTRACT documents' })
  contractStatus?: string | null;
}
