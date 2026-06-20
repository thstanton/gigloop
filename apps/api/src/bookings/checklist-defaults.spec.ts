import {
  CHECKLIST_DEFAULTS,
  filterItemsByStartingStatus,
  type ChecklistDefaultItem,
} from './checklist-defaults';

const addVenue = () => {
  const item = CHECKLIST_DEFAULTS.find((d) => d.key === 'add_venue');
  if (!item) throw new Error('add_venue default missing');
  return item;
};

const buildItinerary = () => {
  const item = CHECKLIST_DEFAULTS.find((d) => d.key === 'build_itinerary');
  if (!item) throw new Error('build_itinerary default missing');
  return item;
};

describe('add_venue checklist default (Module D)', () => {
  it('is a READY-staged default bound to the venue completeness predicate', () => {
    const item = addVenue();
    expect(item.requiredForStatus).toBe('READY');
    expect(item.autoCompleteRule).toEqual({ type: 'completeness', concern: 'venue' });
  });

  it('is enabled by default (a seeded item, just disablable)', () => {
    expect(addVenue().enabled).not.toBe(false);
  });

  describe('seeding inclusion by starting status', () => {
    const keysFor = (status: string) =>
      filterItemsByStartingStatus(CHECKLIST_DEFAULTS, status).map((i) => i.key);

    // A READY-staged item is seeded for bookings whose starting status is *before* READY,
    // and — matching the existing stage-filter semantics for every item (cf.
    // create_balance_invoice) — is NOT seeded for a booking created already at/after READY,
    // where READY-stage prep is treated as already handled outside the system.
    it.each(['ENQUIRY', 'PROVISIONAL', 'CONFIRMED'])(
      'includes add_venue for a booking starting at %s',
      (status) => {
        expect(keysFor(status)).toContain('add_venue');
      },
    );

    it.each(['READY', 'COMPLETE'])(
      'excludes add_venue for a booking starting at %s (same as other READY items)',
      (status) => {
        expect(keysFor(status)).not.toContain('add_venue');
        // sanity: it behaves identically to the existing READY default
        expect(keysFor(status)).not.toContain('create_balance_invoice');
      },
    );
  });

  describe('disabled default is not seeded', () => {
    it('excludes add_venue when the default is disabled (global or per-booking)', () => {
      const defaults: ChecklistDefaultItem[] = CHECKLIST_DEFAULTS.map((d) =>
        d.key === 'add_venue' ? { ...d, enabled: false } : d,
      );
      const keys = filterItemsByStartingStatus(defaults, 'CONFIRMED').map((i) => i.key);
      expect(keys).not.toContain('add_venue');
      // other defaults still seed — only the disabled one drops out
      expect(keys).toContain('create_balance_invoice');
    });
  });
});

describe('build_itinerary checklist default (Module D / #523)', () => {
  it('is a READY-staged default bound to the itinerary completeness predicate', () => {
    const item = buildItinerary();
    expect(item.requiredForStatus).toBe('READY');
    expect(item.autoCompleteRule).toEqual({ type: 'completeness', concern: 'itinerary' });
  });

  it('is enabled by default (a seeded item, just disablable)', () => {
    expect(buildItinerary().enabled).not.toBe(false);
  });

  describe('seeding inclusion by starting status', () => {
    const keysFor = (status: string) =>
      filterItemsByStartingStatus(CHECKLIST_DEFAULTS, status).map((i) => i.key);

    it.each(['ENQUIRY', 'PROVISIONAL', 'CONFIRMED'])(
      'includes build_itinerary for a booking starting at %s',
      (status) => {
        expect(keysFor(status)).toContain('build_itinerary');
      },
    );

    it.each(['READY', 'COMPLETE'])(
      'excludes build_itinerary for a booking starting at %s (same as other READY items)',
      (status) => {
        expect(keysFor(status)).not.toContain('build_itinerary');
        expect(keysFor(status)).not.toContain('add_venue');
      },
    );
  });

  describe('disabled default is not seeded', () => {
    it('excludes build_itinerary when the default is disabled (global or per-booking)', () => {
      const defaults: ChecklistDefaultItem[] = CHECKLIST_DEFAULTS.map((d) =>
        d.key === 'build_itinerary' ? { ...d, enabled: false } : d,
      );
      const keys = filterItemsByStartingStatus(defaults, 'CONFIRMED').map((i) => i.key);
      expect(keys).not.toContain('build_itinerary');
      expect(keys).toContain('add_venue');
    });
  });
});
