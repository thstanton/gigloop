import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class PreviewInvoiceNumberQuery {
  @ApiProperty({ description: 'Whether to preview for a deposit invoice' })
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isDeposit: boolean;
}
