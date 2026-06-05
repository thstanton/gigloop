import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BookingChecklistItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;

  @ApiProperty()
  bookingId: string;

  @ApiPropertyOptional({ nullable: true })
  key: string | null;

  @ApiProperty()
  label: string;

  @ApiProperty({ enum: ['USER', 'CUSTOMER', 'BAND_MEMBER'] })
  completedBy: string;

  @ApiProperty({ enum: ['PENDING', 'BLOCKED', 'COMPLETE', 'FAILED', 'SKIPPED'] })
  state: string;

  @ApiProperty()
  order: number;

  @ApiProperty({ type: [String] })
  dependsOn: string[];

  @ApiPropertyOptional({ nullable: true, type: Object })
  autoCompleteRule: Record<string, unknown> | null;

  @ApiPropertyOptional({ nullable: true })
  requiredForStatus: string | null;

  @ApiPropertyOptional({ nullable: true })
  completedAt: string | null;

  @ApiPropertyOptional({ nullable: true })
  dueDate: string | null;

  @ApiPropertyOptional({ nullable: true, type: Object })
  dueDateRule: Record<string, unknown> | null;

  @ApiPropertyOptional({
    description:
      'Derived from autoCompleteRule: send_email | create_contract | create_deposit_invoice | create_balance_invoice | mark_contract_signed | mark_deposit_received',
  })
  shortcutType?: string;

  @ApiPropertyOptional({ description: 'Template type for send_email shortcuts' })
  shortcutTemplateType?: string;
}
