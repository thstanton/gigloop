import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class SendBandInviteDto {
  @ApiProperty({ description: 'The band invitation template that seeded the compose sheet' })
  @IsUUID()
  templateId!: string;

  @ApiProperty({ example: 'You’re invited to play — 2026-09-15' })
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @ApiProperty({ description: 'Final HTML body from the compose sheet; the server does not re-render it' })
  @IsString()
  @IsNotEmpty()
  body!: string;
}
