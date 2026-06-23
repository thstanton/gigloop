import { ApiProperty } from '@nestjs/swagger';

// One in-scope prerequisite of a previewed reminder (#560), with the phrase for the
// "after you <phrase>" clause the frontend recomputes from the live selection.
export class ReminderPrerequisiteDto {
  @ApiProperty({ description: 'The prerequisite system key.' })
  key: string;

  @ApiProperty({ description: 'Its action phrase, e.g. "create the contract".' })
  phrase: string;
}

// One previewed system reminder for the New Booking form (#560): the rows + coaching the create
// surface renders, identical to the Builder's, without the frontend re-deriving the concern map,
// hints, or prerequisite phrases.
export class ReminderPreviewResponseDto {
  @ApiProperty({ description: 'System reminder key.' })
  key: string;

  @ApiProperty()
  label: string;

  @ApiProperty({ enum: ['overview', 'people', 'venue', 'itinerary', 'music'] })
  concern: 'overview' | 'people' | 'venue' | 'itinerary' | 'music';

  @ApiProperty({
    nullable: true,
    enum: ['PROVISIONAL', 'CONFIRMED', 'READY', 'COMPLETE'],
    description: 'The status this reminder is a prerequisite for; null for a stage-less item.',
  })
  requiredForStatus: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Auto-complete condition ("when …" tail) for client-committed milestones; null otherwise.',
  })
  autoCompleteHint: string | null;

  @ApiProperty({
    type: [ReminderPrerequisiteDto],
    description:
      'In-scope prerequisites with their phrases. The frontend shows the "after you …" clause only ' +
      'while a prerequisite is itself still selected.',
  })
  prerequisites: ReminderPrerequisiteDto[];
}
