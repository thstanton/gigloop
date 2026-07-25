import { PrismaService } from '../prisma/prisma.service';
import { SearchRepository } from './search.repository';

// A minimal, faithful-enough evaluator of the subset of Prisma `where` shapes
// buildBookingSearchWhere / buildContactSearchWhere emit — top-level scalar/`in` equality,
// `AND`/`OR` arrays, nested relation objects, and `{ contains, mode: 'insensitive' }` leaves.
// This lets the test seed real rows across two users and prove the where clause built by the
// repository actually excludes cross-tenant matches, rather than just asserting its shape.
function evalCondition(value: unknown, cond: unknown): boolean {
  if (cond === null || typeof cond !== 'object') return value === cond;
  const c = cond as Record<string, unknown>;
  if ('contains' in c) {
    if (value == null) return false;
    const insensitive = c.mode === 'insensitive';
    const hay = insensitive ? String(value).toLowerCase() : String(value);
    const needle = insensitive ? String(c.contains).toLowerCase() : String(c.contains);
    return hay.includes(needle);
  }
  if ('in' in c) return (c.in as unknown[]).includes(value);
  if (value == null) return false;
  return evalWhere(value as Record<string, unknown>, c);
}

function evalWhere(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'AND') return (cond as Record<string, unknown>[]).every((sub) => evalWhere(row, sub));
    if (key === 'OR') return (cond as Record<string, unknown>[]).some((sub) => evalWhere(row, sub));
    return evalCondition(row[key], cond);
  });
}

function makePrisma(bookingRows: Record<string, unknown>[], contactRows: Record<string, unknown>[]) {
  return {
    booking: {
      findMany: jest.fn(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(bookingRows.filter((r) => evalWhere(r, where))),
      ),
    },
    contact: {
      findMany: jest.fn(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(contactRows.filter((r) => evalWhere(r, where))),
      ),
    },
  } as unknown as PrismaService;
}

describe('SearchRepository', () => {
  describe('cross-tenant exclusion', () => {
    it("excludes another user's matching booking AND matching contact from the results", async () => {
      const bookingRows = [
        {
          id: 'b-u1',
          userId: 'u1',
          title: null,
          date: new Date('2026-08-01'),
          status: 'CONFIRMED',
          eventType: 'WEDDING',
          customer: { name: 'Smith Wedding' },
          venue: { name: 'Barn' },
        },
        {
          id: 'b-u2',
          userId: 'u2',
          title: null,
          date: new Date('2026-08-01'),
          status: 'CONFIRMED',
          eventType: 'WEDDING',
          customer: { name: 'Smith Wedding' },
          venue: null,
        },
      ];
      const contactRows = [
        {
          id: 'c-u1',
          userId: 'u1',
          name: 'Smith',
          email: null,
          phone: null,
          _count: { customerBookings: 0, venueBookings: 0, bookingAgentBookings: 0 },
        },
        {
          id: 'c-u2',
          userId: 'u2',
          name: 'Smith',
          email: null,
          phone: null,
          _count: { customerBookings: 0, venueBookings: 0, bookingAgentBookings: 0 },
        },
      ];
      const repo = new SearchRepository(makePrisma(bookingRows, contactRows));

      const bookingResults = await repo.searchBookings('u1', 'smith');
      expect(bookingResults.map((r) => r.id)).toEqual(['b-u1']);

      const contactResults = await repo.searchContacts('u1', 'smith');
      expect(contactResults.map((r) => r.id)).toEqual(['c-u1']);
    });
  });

  describe('searchBookings', () => {
    it('searches across all six statuses, including CANCELLED and COMPLETE', async () => {
      const bookingRows = [
        {
          id: 'b-cancelled',
          userId: 'u1',
          title: 'Smith Gig',
          date: new Date('2025-01-01'),
          status: 'CANCELLED',
          eventType: 'WEDDING',
          customer: { name: 'Smith' },
          venue: null,
        },
        {
          id: 'b-complete',
          userId: 'u1',
          title: 'Smith Gig 2',
          date: new Date('2025-02-01'),
          status: 'COMPLETE',
          eventType: 'WEDDING',
          customer: { name: 'Smith' },
          venue: null,
        },
      ];
      const repo = new SearchRepository(makePrisma(bookingRows, []));
      const results = await repo.searchBookings('u1', 'smith');
      expect(results.map((r) => r.id).sort((a, b) => a.localeCompare(b))).toEqual([
        'b-cancelled',
        'b-complete',
      ]);
    });
  });

  describe('searchContacts', () => {
    it('returns the per-relation booking counts needed to rank by total booking count', async () => {
      const contactRows = [
        {
          id: 'c1',
          userId: 'u1',
          name: 'Smith',
          email: null,
          phone: null,
          _count: { customerBookings: 2, venueBookings: 1, bookingAgentBookings: 0 },
        },
      ];
      const repo = new SearchRepository(makePrisma([], contactRows));
      const results = await repo.searchContacts('u1', 'smith');
      expect(results[0]._count).toEqual({ customerBookings: 2, venueBookings: 1, bookingAgentBookings: 0 });
    });
  });
});
