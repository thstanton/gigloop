import type { Prisma } from '@prisma/client';
import { buildContactSearchWhere } from './contact-search';

describe('buildContactSearchWhere', () => {
  describe('userId scoping — security invariant', () => {
    it('places userId at the top level of the where clause', () => {
      const where = buildContactSearchWhere('u1', 'smith');
      expect(where.userId).toBe('u1');
    });

    it('scopes to userId even when there is no search term', () => {
      const where = buildContactSearchWhere('u2', undefined);
      expect(where.userId).toBe('u2');
    });

    it("does not allow userId to leak into any OR branch — another user's matching contact must be excluded", () => {
      const where = buildContactSearchWhere('u1', 'smith');
      const andClauses = (where.AND as Prisma.ContactWhereInput[]) ?? [];
      for (const clause of andClauses) {
        const orBranches = (clause.OR as Prisma.ContactWhereInput[]) ?? [];
        for (const branch of orBranches) {
          expect((branch as Record<string, unknown>).userId).toBeUndefined();
        }
      }
    });
  });

  describe('tokenisation', () => {
    it('drops tokens shorter than 2 characters', () => {
      const where = buildContactSearchWhere('u1', 'a smith');
      const andClauses = where.AND as Prisma.ContactWhereInput[] | undefined;
      expect(andClauses).toHaveLength(1);
    });

    it('produces no AND clause when all tokens are below the 2-character threshold', () => {
      const where = buildContactSearchWhere('u1', 'a b');
      expect(where.AND).toBeUndefined();
    });

    it('splits on whitespace and handles multiple consecutive spaces', () => {
      const where = buildContactSearchWhere('u1', '  smith   jones  ');
      const andClauses = where.AND as Prisma.ContactWhereInput[] | undefined;
      expect(andClauses).toHaveLength(2);
    });

    it('produces no AND clause for an empty string', () => {
      const where = buildContactSearchWhere('u1', '');
      expect(where.AND).toBeUndefined();
    });

    it('produces no AND clause for a whitespace-only string', () => {
      const where = buildContactSearchWhere('u1', '   ');
      expect(where.AND).toBeUndefined();
    });

    it('produces no AND clause when q is undefined', () => {
      const where = buildContactSearchWhere('u1', undefined);
      expect(where.AND).toBeUndefined();
    });
  });

  describe('per-field matching — each field produces the correct OR branch', () => {
    function orBranchesFor(q: string): Prisma.ContactWhereInput[] {
      const where = buildContactSearchWhere('u1', q);
      const andClauses = where.AND as Prisma.ContactWhereInput[];
      return andClauses[0].OR as Prisma.ContactWhereInput[];
    }

    it('matches name', () => {
      expect(orBranchesFor('smith')).toEqual(
        expect.arrayContaining([{ name: { contains: 'smith', mode: 'insensitive' } }]),
      );
    });

    it('matches email', () => {
      expect(orBranchesFor('smith@example')).toEqual(
        expect.arrayContaining([{ email: { contains: 'smith@example', mode: 'insensitive' } }]),
      );
    });

    it('matches phone', () => {
      expect(orBranchesFor('01234')).toEqual(
        expect.arrayContaining([{ phone: { contains: '01234', mode: 'insensitive' } }]),
      );
    });

    it('matches addressLine1', () => {
      expect(orBranchesFor('hilton')).toEqual(
        expect.arrayContaining([{ addressLine1: { contains: 'hilton', mode: 'insensitive' } }]),
      );
    });

    it('matches city', () => {
      expect(orBranchesFor('bristol')).toEqual(
        expect.arrayContaining([{ city: { contains: 'bristol', mode: 'insensitive' } }]),
      );
    });

    it('matches county', () => {
      expect(orBranchesFor('devon')).toEqual(
        expect.arrayContaining([{ county: { contains: 'devon', mode: 'insensitive' } }]),
      );
    });

    it('matches postcode', () => {
      expect(orBranchesFor('bs1')).toEqual(
        expect.arrayContaining([{ postcode: { contains: 'bs1', mode: 'insensitive' } }]),
      );
    });

    it('excludes notes from every OR branch', () => {
      const branches = orBranchesFor('parking');
      for (const branch of branches) {
        expect((branch as Record<string, unknown>).notes).toBeUndefined();
      }
      // Also assert the branch count is exactly the 7 matched fields (no notes branch present).
      expect(branches).toHaveLength(7);
    });
  });

  describe('multi-token AND logic', () => {
    it('generates one AND clause per valid token', () => {
      const where = buildContactSearchWhere('u1', 'smith bristol');
      const andClauses = where.AND as Prisma.ContactWhereInput[];
      expect(andClauses).toHaveLength(2);
    });

    it('each AND clause independently searches across all fields for its token', () => {
      const where = buildContactSearchWhere('u1', 'smith bristol');
      const andClauses = where.AND as Prisma.ContactWhereInput[];
      const firstOr = andClauses[0].OR as Prisma.ContactWhereInput[];
      const secondOr = andClauses[1].OR as Prisma.ContactWhereInput[];
      expect(firstOr).toEqual(
        expect.arrayContaining([{ name: { contains: 'smith', mode: 'insensitive' } }]),
      );
      expect(secondOr).toEqual(
        expect.arrayContaining([{ city: { contains: 'bristol', mode: 'insensitive' } }]),
      );
    });
  });
});
