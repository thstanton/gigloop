import {
  venueCompleteness,
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

  describe('isConcernComplete (the autoCompleteRule binding point)', () => {
    it('returns true for venue when venueId is set', () => {
      expect(isConcernComplete('venue', { venueId: 'venue-1' })).toBe(true);
    });

    it('returns false for venue when venueId is unset', () => {
      expect(isConcernComplete('venue', { venueId: null })).toBe(false);
    });

    it('agrees with venueCompleteness (single source — boolean derives from the status)', () => {
      const cases = [{ venueId: 'v' }, { venueId: null }];
      for (const booking of cases) {
        expect(isConcernComplete('venue', booking)).toBe(venueCompleteness(booking) === 'set');
      }
    });
  });
});
