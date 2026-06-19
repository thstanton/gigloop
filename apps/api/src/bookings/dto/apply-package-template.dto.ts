import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ApplyPackageTemplateDto {
  @ApiProperty({ example: 'uuid-of-package-template' })
  @IsUUID()
  packageTemplateId!: string;
}
