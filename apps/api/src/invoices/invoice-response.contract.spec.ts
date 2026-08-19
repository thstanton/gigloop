import { Controller, Get, Module, Param } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ApiResponse, ApiTags, DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { InvoiceResponseDto } from './dto/invoice-response.dto';

// ADR-0071 rule 2: the published contract must equal what ships. The trap this guards is
// specific and silent — `@ApiPropertyOptional({ nullable: true })` on a `string | null`
// *without* an explicit `type:` publishes the field as `type: object`. Nothing errors; the
// generated document is simply untrue, and asserting on the decorators cannot catch it
// (they look correct either way). So this generates the real OpenAPI document and asserts
// on the output.
//
// The line-item schema needs no import: InvoiceResponseDto declares it via
// @ApiProperty({ type: [InvoiceLineItemResponseDto] }), so Swagger emits it transitively.
//
// Scoped to the invoice DTOs — the app-wide guard with its baseline is ADR-0071's own work.

@ApiTags('Invoices')
@Controller('invoices')
class ProbeController {
  @ApiResponse({ status: 200, type: InvoiceResponseDto })
  @Get(':id')
  findOne(@Param('id') _id: string): InvoiceResponseDto {
    return undefined as unknown as InvoiceResponseDto;
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

type Schema = { properties: Record<string, { type?: unknown; nullable?: boolean }> };

describe('InvoiceResponseDto — published OpenAPI contract', () => {
  let invoice: Schema;
  let lineItem: Schema;

  beforeAll(async () => {
    const app = await NestFactory.create(ProbeModule, { logger: false });
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().build());
    const schemas = doc.components?.schemas as unknown as Record<string, Schema>;
    invoice = schemas.InvoiceResponseDto;
    lineItem = schemas.InvoiceLineItemResponseDto;
    await app.close();
  });

  it('publishes every nullable invoice field as a typed scalar, never as type: object', () => {
    const untyped = Object.entries(invoice.properties)
      .filter(([, s]) => s.nullable && (s.type === undefined || s.type === 'object'))
      .map(([name]) => name);
    expect(untyped).toEqual([]);
  });

  it('publishes every nullable line-item field as a typed scalar', () => {
    const untyped = Object.entries(lineItem.properties)
      .filter(([, s]) => s.nullable && (s.type === undefined || s.type === 'object'))
      .map(([name]) => name);
    expect(untyped).toEqual([]);
  });

  // The polymorphic owner pair of ADR-0029 is the reason this DTO has nullable scalars at
  // all, and the pair #844 turns on — a series invoice is precisely the row with
  // `bookingId: null`. Naming them keeps the guard anchored to why it exists.
  it.each(['bookingId', 'seriesId'])('documents %s as a nullable string', (field) => {
    expect(invoice.properties[field]).toMatchObject({ type: 'string', nullable: true });
  });
});
