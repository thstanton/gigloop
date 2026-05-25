import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class SendEmailDto {
  @ApiProperty({ example: 'customer@example.com' })
  @IsEmail()
  to!: string;

  @ApiProperty({ description: 'Contact the email is being sent to (used for the communication record)' })
  @IsUUID()
  contactId!: string;

  @ApiProperty({ example: 'Your booking confirmation' })
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @ApiProperty({ description: 'Template used to generate the email body' })
  @IsUUID()
  templateId!: string;

  @ApiPropertyOptional({ description: 'Invoice ID for invoice-specific variable substitution' })
  @IsOptional()
  @IsUUID()
  invoiceId?: string;
}
