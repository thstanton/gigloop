import {
  venueCompleteness,
  peopleCompleteness,
  itineraryCompleteness,
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

  describe('itineraryCompleteness', () => {
    const noSets = { setsCount: 0, logistics: null };
    const withSets = { setsCount: 2, logistics: null };
    const withSetsAndAnchors = {
      setsCount: 2,
      logistics: {
        arrivalTime: { value: '14:00', shareWithBand: true, shareWithClient: false },
        soundCheckTime: { value: '15:00', shareWithBand: false, shareWithClient: false },
        finishTime: { value: '22:00', shareWithBand: true, shareWithClient: true },
      },
    };
    const withSetsAndPartialAnchors = {
      setsCount: 1,
      logistics: { arrivalTime: { value: '14:00', shareWithBand: true, shareWithClient: false } },
    };

    it('is "empty" when there are no sets', () => {
      expect(itineraryCompleteness(noSets)).toBe('empty');
    });

    it('is "partial" when sets exist but time anchors are missing', () => {
      expect(itineraryCompleteness(withSets)).toBe('partial');
    });

    it('is "partial" when sets exist but only some time anchors are present', () => {
      expect(itineraryCompleteness(withSetsAndPartialAnchors)).toBe('partial');
    });

    it('is "set" when sets exist and all three time anchors are present', () => {
      expect(itineraryCompleteness(withSetsAndAnchors)).toBe('set');
    });

    it('is "empty" when setsCount is 0 regardless of logistics', () => {
      expect(itineraryCompleteness({ setsCount: 0, logistics: withSetsAndAnchors.logistics })).toBe('empty');
    });
  });

  describe('isConcernComplete (the autoCompleteRule binding point)', () => {
    it('returns true for venue when venueId is set', () => {
      expect(isConcernComplete('venue', { venueId: 'venue-1', customerId: 'c1', setsCount: 0, logistics: null })).toBe(true);
    });

    it('returns false for venue when venueId is unset', () => {
      expect(isConcernComplete('venue', { venueId: null, customerId: 'c1', setsCount: 0, logistics: null })).toBe(false);
    });

    it('returns true for people when the customer is set', () => {
      expect(isConcernComplete('people', { venueId: null, customerId: 'c1', setsCount: 0, logistics: null })).toBe(true);
    });

    it('returns false for people when the customer is unset', () => {
      expect(isConcernComplete('people', { venueId: null, customerId: null, setsCount: 0, logistics: null })).toBe(false);
    });

    it('returns true for itinerary when sets exist (partial state)', () => {
      expect(isConcernComplete('itinerary', { venueId: null, customerId: 'c1', setsCount: 1, logistics: null })).toBe(true);
    });

    it('returns true for itinerary when sets exist (set state — all anchors present)', () => {
      const logistics = {
        arrivalTime: { value: '14:00', shareWithBand: true, shareWithClient: false },
        soundCheckTime: { value: '15:00', shareWithBand: false, shareWithClient: false },
        finishTime: { value: '22:00', shareWithBand: true, shareWithClient: true },
      };
      expect(isConcernComplete('itinerary', { venueId: null, customerId: 'c1', setsCount: 2, logistics })).toBe(true);
    });

    it('returns false for itinerary when no sets exist', () => {
      expect(isConcernComplete('itinerary', { venueId: null, customerId: 'c1', setsCount: 0, logistics: null })).toBe(false);
    });

    it('agrees with the rich predicates (single source — boolean derives from the status)', () => {
      const cases = [
        { venueId: 'v', customerId: 'c1', setsCount: 2, logistics: null },
        { venueId: null, customerId: null, setsCount: 0, logistics: null },
      ];
      for (const booking of cases) {
        expect(isConcernComplete('venue', booking)).toBe(venueCompleteness(booking) === 'set');
        expect(isConcernComplete('people', booking)).toBe(peopleCompleteness(booking) === 'set');
        expect(isConcernComplete('itinerary', booking)).toBe(itineraryCompleteness(booking) !== 'empty');
      }
    });
  });
});
