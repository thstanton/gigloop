import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// One row of a concern's "Remind me about" control (Module 2 selector output).
export class ApplicableReminderResponseDto {
  @ApiPropertyOptional({
    nullable: true,
    description: 'The booking item, or null for a discoverable reminder with no record yet.',
  })
  itemId: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'System reminder key; null for a custom item.' })
  key: string | null;

  @ApiProperty()
  label: string;

  @ApiProperty({ description: 'Tracked (not skipped) reads as on; skipped or not-yet-seeded reads as off.' })
  on: boolean;

  @ApiProperty({ enum: ['system', 'custom'] })
  source: 'system' | 'custom';

  @ApiPropertyOptional({
    nullable: true,
    enum: ['PENDING', 'BLOCKED', 'COMPLETE', 'FAILED', 'SKIPPED'],
    description: 'Lifecycle state of the existing item, or null when not yet seeded.',
  })
  state: string | null;

  @ApiPropertyOptional({ nullable: true })
  requiredForStatus: string | null;
}
