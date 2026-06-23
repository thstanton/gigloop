import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdateChecklistItemDto {
  @ApiProperty({
    enum: ['COMPLETE', 'PENDING', 'SKIPPED'],
    description:
      'COMPLETE/PENDING tick or un-tick; SKIPPED opts the reminder out (reversible by setting PENDING).',
  })
  @IsIn(['COMPLETE', 'PENDING', 'SKIPPED'])
  state!: 'COMPLETE' | 'PENDING' | 'SKIPPED';
}
