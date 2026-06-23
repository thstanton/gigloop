import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class RemindersQueryDto {
  @ApiProperty({
    enum: ['overview', 'people', 'venue', 'itinerary', 'music'],
    description: 'The concern whose "Remind me about" list to return.',
  })
  @IsIn(['overview', 'people', 'venue', 'itinerary', 'music'])
  concern!: 'overview' | 'people' | 'venue' | 'itinerary' | 'music';
}
