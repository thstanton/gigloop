import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';

// Assignment is a field write, not a row create/destroy (ADR-0072 §2): the same DTO fills a chair
// (`contactId` set — reusing the contact's existing member row on this booking, or creating one)
// and vacates it (`contactId: null`). Always required (never omitted) so a caller must say which.
export class AssignChairDto {
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Contact to seat in this chair; null vacates it.',
  })
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  contactId!: string | null;
}
