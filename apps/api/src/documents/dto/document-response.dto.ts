import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DocumentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ enum: ['INVOICE', 'CONTRACT'] }) type!: string;
  @ApiProperty() url!: string;
  @ApiPropertyOptional() invoiceId?: string | null;
}
