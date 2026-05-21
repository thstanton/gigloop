import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCommunicationDto {
  @ApiProperty({ description: 'Contact the communication was sent to' })
  @IsUUID()
  contactId!: string;

  @ApiProperty({ example: 'Your booking confirmation' })
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @ApiProperty({ description: 'Rendered HTML body of the email' })
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
