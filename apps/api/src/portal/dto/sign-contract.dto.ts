import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class SignContractDto {
  @ApiProperty({ description: 'Base64-encoded PNG of the signature canvas' })
  @IsString()
  @IsNotEmpty()
  signature: string;
}
