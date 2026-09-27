import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import type { BandMemberStatus } from '../../bookings/band-member-status';

// The dep's one-shot answer (#892) — never ADDED/INVITED, which are organiser-only starting
// states, and never a value the portal itself would need to set twice (the one-shot guard lives
// server-side in band-member-status.ts's `canRespondToBandInvite`, not in this list).
export const BAND_RESPONSE_VALUES = ['CONFIRMED', 'DECLINED'] as const satisfies readonly BandMemberStatus[];

export type BandResponseValue = (typeof BAND_RESPONSE_VALUES)[number];

export class BandRespondDto {
  @ApiProperty({ enum: BAND_RESPONSE_VALUES, description: "The dep's one-shot answer to the invite" })
  @IsIn(BAND_RESPONSE_VALUES)
  response: BandResponseValue;
}
