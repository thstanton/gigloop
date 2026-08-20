// Guard for #872 (ADR-0071): every booking write endpoint's generated OpenAPI response schema
// must reference BookingResponseDto, exactly like the read endpoint already does. Asserts against
// the *generated* document, not the presence of a decorator in source — a decorator can be present
// and still not resolve into the schema the client actually sees (the #871 lesson).
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../app.module';

describe('Booking write endpoints document BookingResponseDto (#872)', () => {
  let document: {
    paths: Record<string, Record<string, { responses?: Record<string, { content?: Record<string, { schema?: unknown }> }> }>>;
  };

  beforeAll(async () => {
    // Mirrors main.ts: SwaggerModule.createDocument only needs the DI-wired module graph, not a
    // running app — app.init() (which would try to connect to a DB via PrismaService.onModuleInit)
    // is deliberately never called.
    const app = await NestFactory.create(AppModule, { logger: false });
    const config = new DocumentBuilder().setTitle('GigLoop API').setVersion('1.0').build();
    document = SwaggerModule.createDocument(app, config) as unknown as typeof document;
  });

  function schemaRef(path: string, method: string, status: string): unknown {
    const schema = document.paths[path]?.[method]?.responses?.[status]?.content?.['application/json']?.schema;
    return schema;
  }

  it.each([
    ['GET /bookings/{id} (read, the reference shape)', '/bookings/{id}', 'get', '200'],
    ['POST /bookings (create)', '/bookings', 'post', '201'],
    ['POST /bookings/{id}/copy (copy)', '/bookings/{id}/copy', 'post', '201'],
    ['PATCH /bookings/{id} (update)', '/bookings/{id}', 'patch', '200'],
    ['PATCH /bookings/{id}/series (updateSeries)', '/bookings/{id}/series', 'patch', '200'],
  ])('%s documents its success response as BookingResponseDto', (_label, path, method, status) => {
    const schema = schemaRef(path, method, status);
    expect(schema).toEqual({ $ref: '#/components/schemas/BookingResponseDto' });
  });
});
