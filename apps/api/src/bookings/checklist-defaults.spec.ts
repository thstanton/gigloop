import {
  CHECKLIST_DEFAULTS,
  computeReminderInsertOrder,
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

  describe('computeReminderInsertOrder (on-demand seed, Module 4)', () => {
    it('places an early-template key first when only later items exist', () => {
      // A booking started at CONFIRMED only seeded READY-stage items.
      const existing = [
        { key: 'create_balance_invoice', order: 1 },
        { key: 'song_requests', order: 2 },
      ];
      // confirm_quote is earlier in the template than both — it should go first.
      expect(computeReminderInsertOrder('confirm_quote', existing)).toBe(1);
    });

    it('places a mid-template key just after its template predecessor (not appended)', () => {
      const existing = [
        { key: 'send_quote', order: 1 }, // template idx 0
        { key: 'play_the_gig', order: 2 }, // template idx 12
      ];
      // get_contract_signed (a mid-template key) follows send_quote, precedes play_the_gig.
      const order = computeReminderInsertOrder('get_contract_signed', existing);
      expect(order).toBe(2); // after send_quote(1); caller shifts play_the_gig to 3
      expect(order).toBeLessThan(3); // strictly before the later item — not appended
    });

    it('ignores custom (keyless) items when finding the preceding position', () => {
      const existing = [
        { key: 'send_quote', order: 1 },
        { key: null, order: 2 }, // a custom item — no template index
      ];
      // confirm_quote (idx 1) follows send_quote; the custom item does not count.
      expect(computeReminderInsertOrder('confirm_quote', existing)).toBe(2);
    });

    it('appends a last-template key after all preceding items', () => {
      const existing = [
        { key: 'send_quote', order: 1 },
        { key: 'confirm_quote', order: 2 },
      ];
      // send_thank_you is the final template item.
      expect(computeReminderInsertOrder('send_thank_you', existing)).toBe(3);
    });
  });
});

describe('send_balance_invoice checklist default (#586)', () => {
  const sendBalance = () => {
    const item = CHECKLIST_DEFAULTS.find((d) => d.key === 'send_balance_invoice');
    if (!item) throw new Error('send_balance_invoice default missing');
    return item;
  };

  it('is a READY-staged send that depends on create_balance_invoice', () => {
    const item = sendBalance();
    expect(item.requiredForStatus).toBe('READY');
    expect(item.dependsOn).toEqual(['create_balance_invoice']);
    expect(item.completedBy).toBe('USER');
    expect(item.autoCompleteRule).toEqual({
      type: 'communicationSent',
      templateTypes: ['balance_invoice_cover'],
    });
    expect(item.dueDateRule).not.toBeNull();
  });

  it('is ordered immediately after create_balance_invoice in the catalog', () => {
    const createIdx = CHECKLIST_DEFAULTS.findIndex((d) => d.key === 'create_balance_invoice');
    const sendIdx = CHECKLIST_DEFAULTS.findIndex((d) => d.key === 'send_balance_invoice');
    expect(sendIdx).toBe(createIdx + 1);
  });

  it('is enabled by default (a seeded item, just disablable)', () => {
    expect(sendBalance().enabled).not.toBe(false);
  });

  describe('seeding inclusion by starting status', () => {
    const keysFor = (status: string) =>
      filterItemsByStartingStatus(CHECKLIST_DEFAULTS, status).map((i) => i.key);

    it.each(['ENQUIRY', 'PROVISIONAL', 'CONFIRMED'])(
      'includes send_balance_invoice for a booking starting at %s',
      (status) => {
        expect(keysFor(status)).toContain('send_balance_invoice');
      },
    );

    it.each(['READY', 'COMPLETE'])(
      'excludes send_balance_invoice for a booking starting at %s (same as other READY items)',
      (status) => {
        expect(keysFor(status)).not.toContain('send_balance_invoice');
        expect(keysFor(status)).not.toContain('create_balance_invoice');
      },
    );
  });
});
