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
        expect(keysFor(status)).not.toContain('invoice_the_balance');
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
      expect(keys).toContain('invoice_the_balance');
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
        { key: 'invoice_the_balance', order: 1 },
        { key: 'gather_song_requests', order: 2 },
      ];
      // get_the_quote_accepted is earlier in the template than both — it should go first.
      expect(computeReminderInsertOrder('get_the_quote_accepted', existing)).toBe(1);
    });

    it('places a mid-template key just after its template predecessor (not appended)', () => {
      const existing = [
        { key: 'get_the_quote_accepted', order: 1 }, // template idx 0
        { key: 'play_the_gig', order: 2 }, // a later template item
      ];
      // get_contract_signed (a mid-template key) follows the quote goal, precedes play_the_gig.
      const order = computeReminderInsertOrder('get_contract_signed', existing);
      expect(order).toBe(2); // after the quote goal(1); caller shifts play_the_gig to 3
      expect(order).toBeLessThan(3); // strictly before the later item — not appended
    });

    it('ignores custom (keyless) items when finding the preceding position', () => {
      const existing = [
        { key: 'get_the_quote_accepted', order: 1 },
        { key: null, order: 2 }, // a custom item — no template index
      ];
      // get_deposit_paid follows the quote goal; the custom item does not count.
      expect(computeReminderInsertOrder('get_deposit_paid', existing)).toBe(2);
    });

    it('appends a last-template key after all preceding items', () => {
      const existing = [
        { key: 'get_the_quote_accepted', order: 1 },
        { key: 'get_deposit_paid', order: 2 },
      ];
      // send_thank_you is the final template item.
      expect(computeReminderInsertOrder('send_thank_you', existing)).toBe(3);
    });
  });
});

describe('invoice_the_balance goal (ADR-0057 / #608, folds #586)', () => {
  const balanceGoal = () => {
    const item = CHECKLIST_DEFAULTS.find((d) => d.key === 'invoice_the_balance');
    if (!item) throw new Error('invoice_the_balance default missing');
    return item;
  };

  it('is a READY-staged multi-step goal with no own rule (state rolls up from its steps)', () => {
    const goal = balanceGoal();
    expect(goal.requiredForStatus).toBe('READY');
    expect(goal.completedBy).toBe('USER');
    expect(goal.autoCompleteRule).toBeNull();
    expect(goal.dependsOn).toEqual([]);
    expect(goal.dueDateRule).not.toBeNull();
  });

  it('owns the issue → send milestone spine (step keys = the unique flat keys)', () => {
    const steps = balanceGoal().steps ?? [];
    expect(steps.map((s) => s.key)).toEqual(['create_balance_invoice', 'send_balance_invoice']);
    // Both are musician ACTIONs; the issue step's rule excludes DRAFT (invoiceExists), the send
    // step auto-completes on the balance_invoice_cover email.
    expect(steps.map((s) => s.completeMode)).toEqual(['ACTION', 'ACTION']);
    expect(steps[0].autoCompleteRule).toEqual({ type: 'invoiceExists', isDeposit: false });
    expect(steps[1].autoCompleteRule).toEqual({
      type: 'communicationSent',
      templateTypes: ['balance_invoice_cover'],
    });
  });

  it('is enabled by default (a seeded item, just disablable)', () => {
    expect(balanceGoal().enabled).not.toBe(false);
  });

  describe('seeding inclusion by starting status', () => {
    const keysFor = (status: string) =>
      filterItemsByStartingStatus(CHECKLIST_DEFAULTS, status).map((i) => i.key);

    it.each(['ENQUIRY', 'PROVISIONAL', 'CONFIRMED'])(
      'includes invoice_the_balance for a booking starting at %s',
      (status) => {
        expect(keysFor(status)).toContain('invoice_the_balance');
      },
    );

    it.each(['READY', 'COMPLETE'])(
      'excludes invoice_the_balance for a booking starting at %s (a READY item)',
      (status) => {
        expect(keysFor(status)).not.toContain('invoice_the_balance');
      },
    );
  });
});

describe('get_deposit_paid goal (ADR-0057 / #608, fixes #585)', () => {
  const depositGoal = () => {
    const item = CHECKLIST_DEFAULTS.find((d) => d.key === 'get_deposit_paid');
    if (!item) throw new Error('get_deposit_paid default missing');
    return item;
  };

  it('is a CONFIRMED-staged multi-step goal with no own rule', () => {
    const goal = depositGoal();
    expect(goal.requiredForStatus).toBe('CONFIRMED');
    expect(goal.completedBy).toBe('USER');
    expect(goal.autoCompleteRule).toBeNull();
    expect(goal.dueDateRule).not.toBeNull();
  });

  it('owns issue → send → received; received is AWAITED (the #585 silent-draft fix)', () => {
    const steps = depositGoal().steps ?? [];
    expect(steps.map((s) => s.key)).toEqual([
      'create_deposit_invoice',
      'send_deposit_invoice',
      'deposit_received',
    ]);
    // create (issue, invoiceExists excludes DRAFT) and send are ACTIONs; deposit_received awaits
    // the external payment.
    expect(steps.map((s) => s.completeMode)).toEqual(['ACTION', 'ACTION', 'AWAITED']);
    expect(steps[0].autoCompleteRule).toEqual({ type: 'invoiceExists', isDeposit: true });
    expect(steps[1].autoCompleteRule).toEqual({
      type: 'communicationSent',
      templateTypes: ['deposit_invoice_cover', 'contract_and_deposit_cover'],
    });
    // deposit_received stays USER (the musician records it), so it still surfaces to the musician,
    // unlike a CUSTOMER-awaited step.
    expect(steps[2].completedBy).toBe('USER');
  });
});

describe('gather_song_requests goal (ADR-0057 / #608)', () => {
  const songGoal = () => {
    const item = CHECKLIST_DEFAULTS.find((d) => d.key === 'gather_song_requests');
    if (!item) throw new Error('gather_song_requests default missing');
    return item;
  };

  it('owns invite → response; response is CUSTOMER/AWAITED (a passive client wait)', () => {
    const goal = songGoal();
    expect(goal.requiredForStatus).toBe('READY');
    expect(goal.autoCompleteRule).toBeNull();
    const steps = goal.steps ?? [];
    expect(steps.map((s) => s.key)).toEqual(['music_form_invite', 'song_requests']);
    expect(steps[0].completeMode).toBe('ACTION');
    expect(steps[1].completeMode).toBe('AWAITED');
    expect(steps[1].completedBy).toBe('CUSTOMER');
    expect(steps[1].autoCompleteRule).toEqual({ type: 'musicFormResponse' });
  });
});
