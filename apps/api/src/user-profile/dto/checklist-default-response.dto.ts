import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DueDateRuleDto } from './update-checklist-defaults.dto';

// Documents the shape of one checklist-default item as returned on `/me`
// (`preferences.checklistDefaults`) — read-only, so Scalar accurately advertises `steps` (#620/#718).
// The write contract (UpdateChecklistDefaultsDto) is separate and never carries steps. Not used as a
// runtime type (getMe returns the whole merged profile); it exists purely for OpenAPI fidelity.

export class ChecklistDefaultStepDto {
  @ApiProperty({ description: "The step's unique flat-template key (e.g. `send_deposit_invoice`)." })
  key!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty({ enum: ['MILESTONE', 'PRECONDITION', 'FOLLOWUP'] })
  kind!: 'MILESTONE' | 'PRECONDITION' | 'FOLLOWUP';

  @ApiProperty({ enum: ['ACTION', 'AWAITED'] })
  completeMode!: 'ACTION' | 'AWAITED';

  @ApiProperty({ enum: ['USER', 'CUSTOMER', 'BAND_MEMBER'] })
  completedBy!: 'USER' | 'CUSTOMER' | 'BAND_MEMBER';

  @ApiProperty({ type: 'object', nullable: true, additionalProperties: true })
  autoCompleteRule!: Record<string, unknown> | null;

  @ApiPropertyOptional({ nullable: true, type: DueDateRuleDto })
  dueDateRule?: DueDateRuleDto | null;
}

export class ChecklistDefaultItemResponseDto {
  @ApiProperty({ nullable: true, description: 'Catalogue key for a system goal; null for a custom item.' })
  key!: string | null;

  @ApiProperty()
  label!: string;

  @ApiProperty({ enum: ['USER', 'CUSTOMER', 'BAND_MEMBER'] })
  completedBy!: 'USER' | 'CUSTOMER' | 'BAND_MEMBER';

  @ApiProperty({ type: 'object', nullable: true, additionalProperties: true })
  autoCompleteRule!: Record<string, unknown> | null;

  @ApiProperty({ nullable: true, enum: ['PROVISIONAL', 'CONFIRMED', 'READY', 'COMPLETE'] })
  requiredForStatus!: 'PROVISIONAL' | 'CONFIRMED' | 'READY' | 'COMPLETE' | null;

  @ApiProperty({ nullable: true, type: DueDateRuleDto })
  dueDateRule!: DueDateRuleDto | null;

  @ApiPropertyOptional()
  enabled?: boolean;

  @ApiPropertyOptional({ nullable: true, description: 'Concern tag for a custom item; unset for system defaults.' })
  concern?: string | null;

  @ApiPropertyOptional({
    type: [ChecklistDefaultStepDto],
    description:
      'Ordered steps of a multi-step system goal (ADR-0057), for the Settings read-only preview (#620/#718). Absent for atomic goals and custom items; never written back.',
  })
  steps?: ChecklistDefaultStepDto[];
}
