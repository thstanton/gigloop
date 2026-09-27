import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class SendBandFinalDetailsDto {
  @ApiProperty({ description: 'The band final-details email template that seeded the compose sheet' })
  @IsUUID()
  templateId!: string;

  @ApiProperty({ example: 'Final details — 2026-09-15' })
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @ApiProperty({ description: 'Final HTML body from the compose sheet; the server does not re-render it' })
  @IsString()
  @IsNotEmpty()
  body!: string;
}
