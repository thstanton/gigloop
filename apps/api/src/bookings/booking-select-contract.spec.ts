// Guard for #873 (ADR-0071): the booking detail query's Prisma `select` must ship exactly the
// fields the response DTOs declare — no more, no less. Asserted against the *generated* OpenAPI
// document (not a hand-restated field list) so the two can never quietly drift apart, the same
// technique booking-response-contract.spec.ts (#872) uses.
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../app.module';
import { bookingDetailSelect, setSelect, packageSelect, bandChairSelect, bandMemberSelect } from './bookings.repository';
import { NESTED_CONTACT_SELECT, CONTRACT_INCLUDE } from './booking.includes';

const sortKeys = (keys: string[]): string[] => [...keys].sort((a, b) => a.localeCompare(b));

describe('Booking detail select matches its response DTOs (#873)', () => {
  let schemas: Record<string, { properties?: Record<string, unknown> }>;

  beforeAll(async () => {
    const app = await NestFactory.create(AppModule, { logger: false });
    const config = new DocumentBuilder().setTitle('GigLoop API').setVersion('1.0').build();
    const document = SwaggerModule.createDocument(app, config) as unknown as {
      components: { schemas: typeof schemas };
    };
    schemas = document.components.schemas;
  });

  function dtoKeys(name: string): string[] {
    const properties = schemas[name]?.properties;
    if (!properties) throw new Error(`Schema ${name} not found in generated document`);
    return sortKeys(Object.keys(properties));
  }

  it('BookingPerformanceSetDto matches setSelect exactly', () => {
    expect(sortKeys(Object.keys(setSelect))).toEqual(dtoKeys('BookingPerformanceSetDto'));
  });

  it('BookingPackageDto matches packageSelect exactly', () => {
    expect(sortKeys(Object.keys(packageSelect))).toEqual(dtoKeys('BookingPackageDto'));
  });

  // BookingBandChairDto carries one field the select never names: `callTime`, derived in
  // mapBooking from the booking's `sets` (ADR-0072 §2) and never selected from the DB — this test
  // declares that one derived field explicitly rather than leaving it untested.
  it('BookingBandChairDto matches bandChairSelect plus the derived callTime', () => {
    expect(sortKeys([...Object.keys(bandChairSelect), 'callTime'])).toEqual(dtoKeys('BookingBandChairDto'));
  });

  it('ContactResponseDto matches the nested contact select exactly (customer/venue/bookingAgent)', () => {
    expect(sortKeys(Object.keys(NESTED_CONTACT_SELECT))).toEqual(dtoKeys('ContactResponseDto'));
  });

  // #885: removed members never reach the select (filtered at the query, not in mapBooking), so
  // unlike BookingBandChairDto's derived callTime, this select matches its DTO with no extras.
  it('BookingBandMemberDto matches bandMemberSelect exactly', () => {
    expect(sortKeys(Object.keys(bandMemberSelect))).toEqual(dtoKeys('BookingBandMemberDto'));
  });

  it('BookingBandMemberContactDto matches the nested member-contact select exactly', () => {
    expect(sortKeys(Object.keys(bandMemberSelect.contact.select))).toEqual(dtoKeys('BookingBandMemberContactDto'));
  });

  it('BookingActiveContractDto matches the nested contract select exactly', () => {
    expect(sortKeys(Object.keys(CONTRACT_INCLUDE.select))).toEqual(dtoKeys('BookingActiveContractDto'));
  });

  it('BookingSeriesRefDto matches the nested series select exactly', () => {
    expect(sortKeys(Object.keys(bookingDetailSelect.series.select))).toEqual(dtoKeys('BookingSeriesRefDto'));
  });

  // The top-level booking select feeds `mapBooking`, which collapses `musicFormConfig` /
  // `musicFormResponse` / `contracts` into `hasMusicFormConfig` / `hasMusicFormResponse` /
  // `activeContract`, and adds `portalVisibility`. Every other selected field passes straight
  // through — that subset must match BookingResponseDto's non-derived fields exactly.
  it('the passthrough fields of the booking select match BookingResponseDto (excluding mapBooking-derived fields)', () => {
    const TRANSFORMED_RELATIONS = new Set(['musicFormConfig', 'musicFormResponse', 'contracts', 'bandChairs', 'bandMembers']);
    const DERIVED_DTO_FIELDS = new Set([
      'hasMusicFormConfig',
      'hasMusicFormResponse',
      'activeContract',
      'portalVisibility',
      'band',
    ]);

    const passthroughSelectKeys = sortKeys(
      Object.keys(bookingDetailSelect).filter((key) => !TRANSFORMED_RELATIONS.has(key)),
    );
    const passthroughDtoKeys = dtoKeys('BookingResponseDto').filter((key) => !DERIVED_DTO_FIELDS.has(key));

    expect(passthroughSelectKeys).toEqual(passthroughDtoKeys);
  });

  function nestedSelectOf(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object') return undefined;
    return (value as { select?: Record<string, unknown> }).select;
  }

  function flattenSelectKeys(obj: Record<string, unknown>): string[] {
    const keys: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      keys.push(key);
      const nested = nestedSelectOf(value);
      if (nested) keys.push(...flattenSelectKeys(nested));
    }
    return keys;
  }

  it('no selected field is named userId, at any level', () => {
    expect(flattenSelectKeys(bookingDetailSelect)).not.toContain('userId');
  });
});
