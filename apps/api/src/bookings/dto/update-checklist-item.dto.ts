import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdateChecklistItemDto {
  @ApiProperty({ enum: ['COMPLETE', 'PENDING'] })
  @IsIn(['COMPLETE', 'PENDING'])
  state!: 'COMPLETE' | 'PENDING';
}
