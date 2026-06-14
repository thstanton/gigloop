import type { Prisma } from '@prisma/client';
import { buildBookingSearchWhere } from './booking-search';

describe('buildBookingSearchWhere', () => {
  describe('userId scoping — security invariant', () => {
    it('places userId at the top level of the where clause', () => {
      const where = buildBookingSearchWhere('u1', 'smith', []);
      expect(where.userId).toBe('u1');
    });

    it('scopes to userId even when there is no search term', () => {
      const where = buildBookingSearchWhere('u2', undefined, []);
      expect(where.userId).toBe('u2');
    });

    it('does not allow userId to leak into any OR branch — another user\'s matching booking must be excluded', () => {
      // If userId were inside the OR tree, a booking owned by 'u2' whose customer name
      // matches 'u1' could be returned. This test verifies userId is a top-level guard.
      const where = buildBookingSearchWhere('u1', 'smith', []);
      const andClauses = (where.AND as Prisma.BookingWhereInput[]) ?? [];
      for (const clause of andClauses) {
        const orBranches = (clause.OR as Prisma.BookingWhereInput[]) ?? [];
        for (const branch of orBranches) {
          expect((branch as Record<string, unknown>).userId).toBeUndefined();
        }
      }
    });
  });

  describe('tokenisation', () => {
    it('drops tokens shorter than 2 characters', () => {
      // "a" is dropped; only "smith" survives → 1 AND clause
      const where = buildBookingSearchWhere('u1', 'a smith', []);
      const andClauses = where.AND as Prisma.BookingWhereInput[] | undefined;
      expect(andClauses).toHaveLength(1);
    });

    it('produces no AND clause when all tokens are below the 2-character threshold', () => {
      const where = buildBookingSearchWhere('u1', 'a b', []);
      expect(where.AND).toBeUndefined();
    });

    it('splits on whitespace and handles multiple consecutive spaces', () => {
      const where = buildBookingSearchWhere('u1', '  smith   jones  ', []);
      const andClauses = where.AND as Prisma.BookingWhereInput[] | undefined;
      expect(andClauses).toHaveLength(2);
    });

    it('produces no AND clause for an empty string', () => {
      const where = buildBookingSearchWhere('u1', '', []);
      expect(where.AND).toBeUndefined();
    });

    it('produces no AND clause for a whitespace-only string', () => {
      const where = buildBookingSearchWhere('u1', '   ', []);
      expect(where.AND).toBeUndefined();
    });

    it('produces no AND clause when q is undefined', () => {
      const where = buildBookingSearchWhere('u1', undefined, []);
      expect(where.AND).toBeUndefined();
    });
  });

  describe('status filtering', () => {
    it('applies no status constraint when statuses array is empty', () => {
      const where = buildBookingSearchWhere('u1', undefined, []);
      expect(where.status).toBeUndefined();
    });

    it('applies a single-status constraint', () => {
      const where = buildBookingSearchWhere('u1', undefined, ['CONFIRMED']);
      expect(where.status).toEqual({ in: ['CONFIRMED'] });
    });

    it('applies multiple statuses', () => {
      const where = buildBookingSearchWhere('u1', undefined, ['ENQUIRY', 'PROVISIONAL']);
      expect(where.status).toEqual({ in: ['ENQUIRY', 'PROVISIONAL'] });
    });
  });

  describe('per-field matching — each field produces the correct OR branch', () => {
    function orBranchesFor(q: string): Prisma.BookingWhereInput[] {
      const where = buildBookingSearchWhere('u1', q, []);
      const andClauses = where.AND as Prisma.BookingWhereInput[];
      return andClauses[0].OR as Prisma.BookingWhereInput[];
    }

    it('matches booking title', () => {
      expect(orBranchesFor('wedding')).toEqual(
        expect.arrayContaining([
          { title: { contains: 'wedding', mode: 'insensitive' } },
        ]),
      );
    });

    it('matches customer name', () => {
      expect(orBranchesFor('smith')).toEqual(
        expect.arrayContaining([
          { customer: { name: { contains: 'smith', mode: 'insensitive' } } },
        ]),
      );
    });

    it('matches customer email', () => {
      expect(orBranchesFor('smith@example')).toEqual(
        expect.arrayContaining([
          { customer: { email: { contains: 'smith@example', mode: 'insensitive' } } },
        ]),
      );
    });

    it('matches venue name', () => {
      expect(orBranchesFor('hilton')).toEqual(
        expect.arrayContaining([
          { venue: { name: { contains: 'hilton', mode: 'insensitive' } } },
        ]),
      );
    });

    it('matches booking-agent name', () => {
      expect(orBranchesFor('agency')).toEqual(
        expect.arrayContaining([
          { bookingAgent: { name: { contains: 'agency', mode: 'insensitive' } } },
        ]),
      );
    });

    it('matches series label', () => {
      expect(orBranchesFor('residency')).toEqual(
        expect.arrayContaining([
          { series: { label: { contains: 'residency', mode: 'insensitive' } } },
        ]),
      );
    });

    it('matches event type', () => {
      expect(orBranchesFor('wedding')).toEqual(
        expect.arrayContaining([
          { eventType: { contains: 'wedding', mode: 'insensitive' } },
        ]),
      );
    });

    it('matches notes', () => {
      expect(orBranchesFor('parking')).toEqual(
        expect.arrayContaining([
          { notes: { contains: 'parking', mode: 'insensitive' } },
        ]),
      );
    });
  });

  describe('multi-token AND logic', () => {
    it('generates one AND clause per valid token', () => {
      // "smith wedding" → 2 tokens → 2 AND clauses
      const where = buildBookingSearchWhere('u1', 'smith wedding', []);
      const andClauses = where.AND as Prisma.BookingWhereInput[];
      expect(andClauses).toHaveLength(2);
    });

    it('each AND clause independently searches across all fields for its token', () => {
      const where = buildBookingSearchWhere('u1', 'smith wedding', []);
      const andClauses = where.AND as Prisma.BookingWhereInput[];
      const firstOr = andClauses[0].OR as Prisma.BookingWhereInput[];
      const secondOr = andClauses[1].OR as Prisma.BookingWhereInput[];
      // First token ("smith") must appear in first OR
      expect(firstOr).toEqual(
        expect.arrayContaining([
          { customer: { name: { contains: 'smith', mode: 'insensitive' } } },
        ]),
      );
      // Second token ("wedding") must appear in second OR
      expect(secondOr).toEqual(
        expect.arrayContaining([
          { title: { contains: 'wedding', mode: 'insensitive' } },
        ]),
      );
    });
  });

  describe('combined status + search', () => {
    it('applies userId, status filter, and search AND clauses together', () => {
      const where = buildBookingSearchWhere('u1', 'smith', ['CONFIRMED']);
      expect(where.userId).toBe('u1');
      expect(where.status).toEqual({ in: ['CONFIRMED'] });
      const andClauses = where.AND as Prisma.BookingWhereInput[];
      expect(andClauses).toHaveLength(1);
    });
  });

  describe('eventType filtering', () => {
    it('applies no eventType constraint when not provided', () => {
      const where = buildBookingSearchWhere('u1', undefined, []);
      expect(where.eventType).toBeUndefined();
    });

    it('applies an equality match when eventType is provided', () => {
      const where = buildBookingSearchWhere('u1', undefined, [], 'WEDDING');
      expect(where.eventType).toBe('WEDDING');
    });

    it('applies top-level eventType equality alongside free-text search AND clauses', () => {
      // eventType equality is a top-level guard; the free-text OR branches still run
      const where = buildBookingSearchWhere('u1', 'smith', ['CONFIRMED'], 'CORPORATE');
      expect(where.userId).toBe('u1');
      expect(where.status).toEqual({ in: ['CONFIRMED'] });
      expect(where.eventType).toBe('CORPORATE');
      const andClauses = where.AND as Prisma.BookingWhereInput[] | undefined;
      expect(andClauses).toHaveLength(1);
    });

    it('applies no eventType constraint when provided as undefined', () => {
      const where = buildBookingSearchWhere('u1', undefined, [], undefined);
      expect(where.eventType).toBeUndefined();
    });
  });
});
