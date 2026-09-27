import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export const COMMUNICATION_CHANNELS = [
  { value: 'EMAIL' },
  { value: 'MANUAL' },
] as const satisfies readonly { value: string }[];

const communicationChannelValues = COMMUNICATION_CHANNELS.map(({ value }) => value);
export type CommunicationChannel = (typeof COMMUNICATION_CHANNELS)[number]['value'];

export class CreateCommunicationDto {
  @ApiPropertyOptional({ enum: communicationChannelValues, default: 'EMAIL' })
  @IsOptional()
  @IsIn(communicationChannelValues)
  channel?: CommunicationChannel;

  @ApiProperty({ description: 'Contact the communication was sent to' })
  @IsUUID()
  contactId!: string;

  @ApiProperty({ example: 'Your booking confirmation' })
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @ApiProperty({ description: 'Communication body; HTML for email and plain text for manual messages' })
  @IsString()
  @IsNotEmpty()
  body!: string;

  @ApiPropertyOptional({ description: 'Template used to generate this communication' })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiPropertyOptional({ description: 'When the communication was sent (ISO 8601); defaults to now' })
  @IsOptional()
  @IsISO8601()
  sentAt?: string;
}
