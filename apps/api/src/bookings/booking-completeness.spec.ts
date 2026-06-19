import {
  venueCompleteness,
  peopleCompleteness,
  isConcernComplete,
} from './booking-completeness';

describe('booking-completeness (Module A)', () => {
  describe('venueCompleteness', () => {
    it('is "set" when venueId is present', () => {
      expect(venueCompleteness({ venueId: 'venue-1' })).toBe('set');
    });

    it('is "unset" when venueId is null', () => {
      expect(venueCompleteness({ venueId: null })).toBe('unset');
    });

    it('treats an empty-string venueId as set (a chosen id, never blank in practice)', () => {
      // venueId is a UUID FK — it is either a real id or null. Guard only against null/undefined.
      expect(venueCompleteness({ venueId: '' })).toBe('set');
    });
  });

  describe('peopleCompleteness', () => {
    it('is "set" when the customer is present', () => {
      expect(peopleCompleteness({ customerId: 'cust-1' })).toBe('set');
    });

    it('is "unset" when there is no customer (pre-commit create flow)', () => {
      expect(peopleCompleteness({ customerId: null })).toBe('unset');
    });

    it('ignores the (optional) booking agent — customer alone makes People complete', () => {
      // The agent is genuinely optional, so it is not part of the predicate at all.
      expect(peopleCompleteness({ customerId: 'cust-1' })).toBe('set');
    });
  });

  describe('isConcernComplete (the autoCompleteRule binding point)', () => {
    it('returns true for venue when venueId is set', () => {
      expect(isConcernComplete('venue', { venueId: 'venue-1', customerId: 'c1' })).toBe(true);
    });

    it('returns false for venue when venueId is unset', () => {
      expect(isConcernComplete('venue', { venueId: null, customerId: 'c1' })).toBe(false);
    });

    it('returns true for people when the customer is set', () => {
      expect(isConcernComplete('people', { venueId: null, customerId: 'c1' })).toBe(true);
    });

    it('returns false for people when the customer is unset', () => {
      expect(isConcernComplete('people', { venueId: null, customerId: null })).toBe(false);
    });

    it('agrees with the rich predicates (single source — boolean derives from the status)', () => {
      const cases = [
        { venueId: 'v', customerId: 'c1' },
        { venueId: null, customerId: null },
      ];
      for (const booking of cases) {
        expect(isConcernComplete('venue', booking)).toBe(venueCompleteness(booking) === 'set');
        expect(isConcernComplete('people', booking)).toBe(peopleCompleteness(booking) === 'set');
      }
    });
  });
});
