// Fixtures for the openapi-nullable-scalars guard spec (#871). Named
// `.dto.ts` deliberately, but kept under test/ so it is never swept into the
// real app's DTO scan or its generated OpenAPI document.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BadNullableScalarFixtureDto {
  // No explicit `type:` — reflect-metadata falls back to `type: object` for a
  // `string | null` union. This is the exact bug #871 exists to catch.
  @ApiPropertyOptional({ nullable: true })
  broken: string | null;
}

export class GoodNullableScalarFixtureDto {
  @ApiPropertyOptional({ nullable: true, type: String })
  fine: string | null;
}

export class MissingNullableFlagFixtureDto {
  // Decorator omits `nullable: true` entirely, despite the TS type being
  // nullable — still generates `type: object` with no `nullable` flag either.
  // Candidacy is TS-type-driven precisely so this is still caught.
  @ApiPropertyOptional()
  sneaky: string | null;
}

export class NonNullableEnumFixtureDto {
  // No `null` in the union at all — must never be treated as a candidate,
  // even though stripping `null` from a real nullable union leaves an
  // identical-looking string-literal shape.
  @ApiProperty({ enum: ['a', 'b'] })
  notNullable: 'a' | 'b';
}
