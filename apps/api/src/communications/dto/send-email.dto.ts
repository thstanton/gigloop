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

  @ApiProperty({ description: 'Final rendered HTML body to send (produced by the render endpoint, optionally edited by the musician)' })
  @IsString()
  @IsNotEmpty()
  body!: string;

  @ApiPropertyOptional({ description: 'Template that seeded the body — recorded on the communication for reference only; no re-rendering occurs' })
  @IsOptional()
  @IsUUID()
  templateId?: string;
}
