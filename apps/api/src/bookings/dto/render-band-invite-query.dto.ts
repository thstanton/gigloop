import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class RenderBandInviteQueryDto {
  @ApiProperty({ description: 'The built-in band invitation email template to render' })
  @IsUUID()
  templateId!: string;
}
