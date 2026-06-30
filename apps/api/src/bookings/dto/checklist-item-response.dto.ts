import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ADR-0057: a step of a multi-step goal. The active step (first non-terminal by order)
// and the completed-step fold are derived on the client — never stored.
export class BookingChecklistStepResponseDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional({ nullable: true })
  key: string | null;

  @ApiProperty()
  label: string;

  @ApiProperty()
  order: number;

  @ApiProperty({ enum: ['MILESTONE', 'PRECONDITION', 'FOLLOWUP'] })
  kind: string;

  @ApiProperty({ enum: ['ACTION', 'AWAITED'] })
  completeMode: string;

  @ApiProperty({ enum: ['PENDING', 'COMPLETE', 'FAILED'] })
  state: string;

  @ApiProperty({ enum: ['USER', 'CUSTOMER', 'BAND_MEMBER'] })
  completedBy: string;

  @ApiPropertyOptional({ nullable: true })
  completedAt: string | null;

  @ApiPropertyOptional({ nullable: true, type: Object })
  autoCompleteRule: Record<string, unknown> | null;
}

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

  // ADR-0057 / #609: BLOCKED retires from the surfaced contract. The active step is derived
  // (first non-terminal), intra-goal order is intrinsic and inter-goal order is soft status —
  // nothing the evaluator emits is ever BLOCKED. (Legacy DB rows are normalised on next evaluate.)
  @ApiProperty({ enum: ['PENDING', 'COMPLETE', 'FAILED', 'SKIPPED'] })
  state: string;

  @ApiProperty()
  order: number;

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
    nullable: true,
    enum: ['overview', 'people', 'venue', 'itinerary', 'music'],
    description: 'Per-concern grouping; null for a concern-less custom item.',
  })
  concern: string | null;

  @ApiPropertyOptional({
    description:
      'Derived from autoCompleteRule: send_email | create_contract | create_deposit_invoice | create_balance_invoice | mark_contract_signed | mark_deposit_received',
  })
  shortcutType?: string;

  @ApiPropertyOptional({ description: 'Template type for send_email shortcuts' })
  shortcutTemplateType?: string;

  @ApiPropertyOptional({
    type: [BookingChecklistStepResponseDto],
    description:
      'Ordered steps of a multi-step goal (ADR-0057). Empty/absent for an atomic goal. The goal state is the roll-up of these steps.',
  })
  steps?: BookingChecklistStepResponseDto[];
}
