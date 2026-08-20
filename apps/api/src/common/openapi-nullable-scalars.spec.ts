// Guard for #871: fails when a nullable scalar is documented in the
// *generated* OpenAPI document as `type: object` instead of its real type.
// Runs as an ordinary unit spec (`bun run test`) — no new CI step.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Controller, Get, Module, Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ApiOkResponse, DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../app.module';
import {
  checkNullableScalarCandidates,
  findNullableScalarCandidates,
  scanFileForNullableScalarCandidates,
  type OpenApiDocumentLike,
} from '../../test/openapi-nullable-scalars';
import {
  BadNullableScalarFixtureDto,
  GoodNullableScalarFixtureDto,
  MissingNullableFlagFixtureDto,
  NonNullableEnumFixtureDto,
} from '../../test/__fixtures__/nullable-scalar-fixture.dto';

const BASELINE_PATH = resolve(__dirname, '..', '..', '..', '..', 'scripts', 'openapi-nullable-scalars-baseline.txt');

function loadBaseline(): Set<string> {
  if (!existsSync(BASELINE_PATH)) return new Set();
  return new Set(
    readFileSync(BASELINE_PATH, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#')),
  );
}

// Mirrors main.ts's document generation. SwaggerModule.createDocument only
// needs the DI-wired module graph, not a running app — app.init() (which
// would call PrismaService.onModuleInit and try to connect to a DB) is
// deliberately never called, exactly as main.ts calls it before app.listen().
async function buildOpenApiDocument(rootModule: Type<unknown>, title: string): Promise<OpenApiDocumentLike> {
  const app = await NestFactory.create(rootModule, { logger: false });
  const config = new DocumentBuilder().setTitle(title).setVersion('1.0').build();
  return SwaggerModule.createDocument(app, config) as unknown as OpenApiDocumentLike;
}

describe('OpenAPI nullable-scalar guard (#871)', () => {
  let document: OpenApiDocumentLike & { components: { schemas: Record<string, { properties: Record<string, unknown> }> } };

  beforeAll(async () => {
    document = (await buildOpenApiDocument(AppModule, 'GigLoop API')) as typeof document;
  });

  it('documents every nullable scalar across apps/api/src with its real type', () => {
    const srcRoot = resolve(__dirname, '..');
    const candidates = findNullableScalarCandidates(srcRoot);
    const violations = checkNullableScalarCandidates(document, candidates);
    const baseline = loadBaseline();
    const newViolations = violations.filter((v) => !baseline.has(v.key));

    if (newViolations.length) {
      const list = newViolations.map((v) => `  ${v.key}`).join('\n');
      throw new Error(
        `New nullable-scalar violation(s) — documented as "type: object" instead of the real scalar type:\n${list}\n\n` +
          'Add an explicit type: (String/Number/Boolean) to the @ApiProperty[Optional] decorator. ' +
          'If this is genuine pre-existing debt outside this change, add it to ' +
          'scripts/openapi-nullable-scalars-baseline.txt instead — never widen this guard to pass it.',
      );
    }
    expect(newViolations).toEqual([]);
  });

  it('documents InvoiceResponseDto.billToContact via ContactResponseDto', () => {
    const schema = document.components.schemas.InvoiceResponseDto;
    const billToContact = schema.properties.billToContact;
    expect(JSON.stringify(billToContact)).toContain('ContactResponseDto');
  });

  describe('detection proof (fixture, not assertion)', () => {
    let fixtureDocument: OpenApiDocumentLike;

    beforeAll(async () => {
      @Controller('fixture')
      class FixtureController {
        @Get('bad')
        @ApiOkResponse({ type: BadNullableScalarFixtureDto })
        bad() {
          return {} as BadNullableScalarFixtureDto;
        }

        @Get('good')
        @ApiOkResponse({ type: GoodNullableScalarFixtureDto })
        good() {
          return {} as GoodNullableScalarFixtureDto;
        }

        @Get('sneaky')
        @ApiOkResponse({ type: MissingNullableFlagFixtureDto })
        sneaky() {
          return {} as MissingNullableFlagFixtureDto;
        }

        @Get('not-nullable')
        @ApiOkResponse({ type: NonNullableEnumFixtureDto })
        notNullable() {
          return {} as NonNullableEnumFixtureDto;
        }
      }

      @Module({ controllers: [FixtureController] })
      class FixtureModule {}

      fixtureDocument = await buildOpenApiDocument(FixtureModule, 'fixture');
    });

    it('flags an untyped nullable scalar as a violation, even when the decorator never sets nullable: true', () => {
      const fixtureFile = resolve(__dirname, '..', '..', 'test', '__fixtures__', 'nullable-scalar-fixture.dto.ts');
      const candidates = scanFileForNullableScalarCandidates(fixtureFile);
      const violationKeys = checkNullableScalarCandidates(fixtureDocument, candidates).map((v) => v.key);

      expect(violationKeys).toContain('BadNullableScalarFixtureDto.broken');
      expect(violationKeys).toContain('MissingNullableFlagFixtureDto.sneaky');
      expect(violationKeys).not.toContain('GoodNullableScalarFixtureDto.fine');
    });

    it('never treats a non-nullable string-literal union as a candidate', () => {
      const fixtureFile = resolve(__dirname, '..', '..', 'test', '__fixtures__', 'nullable-scalar-fixture.dto.ts');
      const candidates = scanFileForNullableScalarCandidates(fixtureFile);

      expect(candidates.map((c) => `${c.className}.${c.propertyName}`)).not.toContain(
        'NonNullableEnumFixtureDto.notNullable',
      );
    });
  });
});
