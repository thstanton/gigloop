import {
  CHECKLIST_DEFAULTS,
  computeReminderInsertOrder,
  dueDateRuleEqual,
  filterItemsByStartingStatus,
  getChecklistDefaults,
  sparsifySystemOverrides,
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
  it('is a CONFIRMED-staged default bound to the venue completeness predicate', () => {
    const item = addVenue();
    expect(item.requiredForStatus).toBe('CONFIRMED');
    expect(item.autoCompleteRule).toEqual({ type: 'completeness', concern: 'venue' });
  });

  // #759: the venue must be settled before the contract is created, because contract
  // variables are substituted at creation and never re-substituted. Goals sort by stage
  // first and catalogue order within the stage, so this needs both the CONFIRMED stage
  // above and the catalogue position asserted here.
  it('precedes the contract goal in the catalogue', () => {
    const keys = CHECKLIST_DEFAULTS.map((d) => d.key);
    expect(keys.indexOf('add_venue')).toBeLessThan(keys.indexOf('get_contract_signed'));
  });

  it('shares the contract goal’s stage, so ordering is decided by catalogue position', () => {
    const contract = CHECKLIST_DEFAULTS.find((d) => d.key === 'get_contract_signed');
    expect(addVenue().requiredForStatus).toBe(contract?.requiredForStatus);
  });

  it('is enabled by default (a seeded item, just disablable)', () => {
    expect(addVenue().enabled).not.toBe(false);
  });

  describe('seeding inclusion by starting status', () => {
    const keysFor = (status: string) =>
      filterItemsByStartingStatus(CHECKLIST_DEFAULTS, status).map((i) => i.key);

    // A CONFIRMED-staged item is seeded for bookings whose starting status is *before*
    // CONFIRMED, and — matching the existing stage-filter semantics for every item —
    // is NOT seeded for a booking created already at/after CONFIRMED.
    it.each(['ENQUIRY', 'PROVISIONAL'])(
      'includes add_venue for a booking starting at %s',
      (status) => {
        expect(keysFor(status)).toContain('add_venue');
      },
    );

    // #759, accepted deliberately: a booking created at CONFIRMED forgoes the whole
    // CONFIRMED stage — it already forgoes get_contract_signed — so it no longer seeds
    // add_venue either. Pinned so this is not later mistaken for a regression.
    it.each(['CONFIRMED', 'READY', 'COMPLETE'])(
      'excludes add_venue for a booking starting at %s (same as every CONFIRMED item)',
      (status) => {
        expect(keysFor(status)).not.toContain('add_venue');
        // sanity: it behaves identically to the other CONFIRMED-staged goal
        expect(keysFor(status)).not.toContain('get_contract_signed');
      },
    );
  });

  describe('disabled default is not seeded', () => {
    it('excludes add_venue when the default is disabled (global or per-booking)', () => {
      const defaults: ChecklistDefaultItem[] = CHECKLIST_DEFAULTS.map((d) =>
        d.key === 'add_venue' ? { ...d, enabled: false } : d,
      );
      // PROVISIONAL, not CONFIRMED — add_venue is CONFIRMED-staged, so a CONFIRMED start
      // would exclude it by stage and the assertion would pass without the disable doing
      // any work.
      const keys = filterItemsByStartingStatus(defaults, 'PROVISIONAL').map((i) => i.key);
      expect(keys).not.toContain('add_venue');
      // other defaults still seed — only the disabled one drops out
      expect(keys).toContain('get_the_balance_paid');
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
      },
    );
  });

  describe('disabled default is not seeded', () => {
    it('excludes build_itinerary when the default is disabled (global or per-booking)', () => {
      const defaults: ChecklistDefaultItem[] = CHECKLIST_DEFAULTS.map((d) =>
        d.key === 'build_itinerary' ? { ...d, enabled: false } : d,
      );
      const keys = filterItemsByStartingStatus(defaults, 'PROVISIONAL').map((i) => i.key);
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

describe('get_the_balance_paid goal (ADR-0057 / #608 / #617, folds #586)', () => {
  const balanceGoal = () => {
    const item = CHECKLIST_DEFAULTS.find((d) => d.key === 'get_the_balance_paid');
    if (!item) throw new Error('get_the_balance_paid default missing');
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

  it('owns create → issue → send → received; create includes drafts, issue excludes them (#617)', () => {
    const steps = balanceGoal().steps ?? [];
    const milestones = steps.filter((s) => s.kind === 'MILESTONE');
    expect(milestones.map((s) => s.key)).toEqual([
      'create_balance_invoice',
      'issue_balance_invoice',
      'send_balance_invoice',
      'balance_received',
    ]);
    // create/issue/send are musician ACTIONs; balance_received awaits payment (USER records it).
    expect(milestones.map((s) => s.completeMode)).toEqual(['ACTION', 'ACTION', 'ACTION', 'AWAITED']);
    const byKey = (k: string) => steps.find((s) => s.key === k)!;
    expect(byKey('create_balance_invoice').autoCompleteRule).toEqual({ type: 'invoiceExists', isDeposit: false, includeDraft: true });
    expect(byKey('issue_balance_invoice').autoCompleteRule).toEqual({ type: 'invoiceExists', isDeposit: false });
    expect(byKey('send_balance_invoice').autoCompleteRule).toEqual({
      type: 'communicationSent',
      templateTypes: ['balance_invoice_cover'],
    });
    // balance_received is USER-awaited; it completes when the balance invoice is PAID (#653 —
    // there is no balanceReceivedAt field, so it reads invoice status), and keeps surfacing
    // (chase the money) until then.
    expect(byKey('balance_received')).toMatchObject({
      completedBy: 'USER',
      autoCompleteRule: { type: 'invoicePaid', isDeposit: false },
    });
  });

  it('is enabled by default (a seeded item, just disablable)', () => {
    expect(balanceGoal().enabled).not.toBe(false);
  });

  describe('seeding inclusion by starting status', () => {
    const keysFor = (status: string) =>
      filterItemsByStartingStatus(CHECKLIST_DEFAULTS, status).map((i) => i.key);

    it.each(['ENQUIRY', 'PROVISIONAL', 'CONFIRMED'])(
      'includes get_the_balance_paid for a booking starting at %s',
      (status) => {
        expect(keysFor(status)).toContain('get_the_balance_paid');
      },
    );

    it.each(['READY', 'COMPLETE'])(
      'excludes get_the_balance_paid for a booking starting at %s (a READY item)',
      (status) => {
        expect(keysFor(status)).not.toContain('get_the_balance_paid');
      },
    );
  });
});

describe('get_deposit_paid goal (ADR-0057 / #608 / #617, fixes #585)', () => {
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

  it('owns create → issue → send → received; create includes drafts, issue excludes them (#617)', () => {
    const steps = depositGoal().steps ?? [];
    const milestones = steps.filter((s) => s.kind === 'MILESTONE');
    expect(milestones.map((s) => s.key)).toEqual([
      'create_deposit_invoice',
      'issue_deposit_invoice',
      'send_deposit_invoice',
      'deposit_received',
    ]);
    // create/issue/send are ACTIONs; deposit_received awaits the external payment.
    expect(milestones.map((s) => s.completeMode)).toEqual(['ACTION', 'ACTION', 'ACTION', 'AWAITED']);
    const byKey = (k: string) => steps.find((s) => s.key === k)!;
    // create includes drafts (a saved draft advances the goal); issue excludes them (the #585 fix).
    expect(byKey('create_deposit_invoice').autoCompleteRule).toEqual({ type: 'invoiceExists', isDeposit: true, includeDraft: true });
    expect(byKey('issue_deposit_invoice').autoCompleteRule).toEqual({ type: 'invoiceExists', isDeposit: true });
    expect(byKey('send_deposit_invoice').autoCompleteRule).toEqual({
      type: 'communicationSent',
      templateTypes: ['deposit_invoice_cover', 'contract_and_deposit_cover'],
    });
    // deposit_received stays USER (the musician records it), so it still surfaces to the musician.
    expect(byKey('deposit_received').completedBy).toBe('USER');
  });
});

describe('gather_song_requests goal (ADR-0057 / #608)', () => {
  const songGoal = () => {
    const item = CHECKLIST_DEFAULTS.find((d) => d.key === 'gather_song_requests');
    if (!item) throw new Error('gather_song_requests default missing');
    return item;
  };

  it('owns publish → invite → response; response is CUSTOMER/AWAITED (a passive client wait)', () => {
    const goal = songGoal();
    expect(goal.requiredForStatus).toBe('READY');
    expect(goal.autoCompleteRule).toBeNull();
    const steps = goal.steps ?? [];
    // #533/#630: publish is the first milestone (mirrors invoice create→issue→send).
    const milestones = steps.filter((s) => s.kind === 'MILESTONE');
    expect(milestones.map((s) => s.key)).toEqual(['set_up_and_publish', 'music_form_invite', 'song_requests']);
    expect(milestones[0].completeMode).toBe('ACTION');
    expect(milestones[0].completedBy).toBe('USER');
    expect(milestones[0].autoCompleteRule).toEqual({ type: 'musicFormPublished' });
    expect(milestones[1].completeMode).toBe('ACTION');
    expect(milestones[2].completeMode).toBe('AWAITED');
    expect(milestones[2].completedBy).toBe('CUSTOMER');
    expect(milestones[2].autoCompleteRule).toEqual({ type: 'musicFormResponse' });
  });

  it('orders publish before the add-email precondition, so publishing is not gated on the email (#533/#630)', () => {
    const keys = (songGoal().steps ?? []).map((s) => s.key);
    expect(keys).toEqual(['set_up_and_publish', 'add_email_music', 'music_form_invite', 'song_requests']);
    // The email precondition sits immediately before the invite it gates — not before publish.
    expect(keys.indexOf('set_up_and_publish')).toBeLessThan(keys.indexOf('add_email_music'));
    expect(keys.indexOf('add_email_music')).toBeLessThan(keys.indexOf('music_form_invite'));
  });
});

describe('precondition steps (ADR-0057 / #618)', () => {
  const goal = (key: string) => {
    const item = CHECKLIST_DEFAULTS.find((d) => d.key === key);
    if (!item) throw new Error(`${key} default missing`);
    return item;
  };
  const stepKeys = (key: string) => (goal(key).steps ?? []).map((s) => s.key);

  it('puts "Set the booking fee" first on every deal-spine goal (whole spine, not just billing)', () => {
    for (const key of ['get_the_quote_accepted', 'get_contract_signed', 'get_deposit_paid', 'get_the_balance_paid']) {
      const first = (goal(key).steps ?? [])[0];
      expect(first).toMatchObject({
        kind: 'PRECONDITION',
        completeMode: 'ACTION',
        completedBy: 'USER',
        autoCompleteRule: { type: 'bookingField', field: 'fee', operator: 'notNull' },
      });
      expect(first.key).toMatch(/^set_fee_/);
    }
  });

  it('puts "Add the client\'s email" on every emailing goal, before its first send', () => {
    // Every emailing goal carries an add_email precondition; the music goal has email but NO fee.
    for (const key of ['get_the_quote_accepted', 'get_contract_signed', 'get_deposit_paid', 'get_the_balance_paid', 'gather_song_requests']) {
      const email = (goal(key).steps ?? []).find((s) => s.key.startsWith('add_email_'));
      expect(email).toMatchObject({ kind: 'PRECONDITION', autoCompleteRule: { type: 'customerEmail' } });
    }
    expect(stepKeys('gather_song_requests')).not.toContainEqual(expect.stringMatching(/^set_fee_/));
  });

  it('uses goal-unique precondition keys (the #608 flat-registry collision rule)', () => {
    const allPreconditionKeys = CHECKLIST_DEFAULTS.flatMap((d) =>
      (d.steps ?? []).filter((s) => s.kind === 'PRECONDITION').map((s) => s.key),
    );
    expect(new Set(allPreconditionKeys).size).toBe(allPreconditionKeys.length); // no duplicates
  });
});

describe('dueDateRuleEqual (ADR-0060)', () => {
  it('treats structurally identical rules as equal', () => {
    expect(
      dueDateRuleEqual(
        { basis: 'bookingDate', offsetDays: -14 },
        { basis: 'bookingDate', offsetDays: -14 },
      ),
    ).toBe(true);
  });

  it('distinguishes a different offset or basis', () => {
    expect(
      dueDateRuleEqual(
        { basis: 'bookingDate', offsetDays: -14 },
        { basis: 'bookingDate', offsetDays: -21 },
      ),
    ).toBe(false);
    expect(
      dueDateRuleEqual(
        { basis: 'bookingDate', offsetDays: -14 },
        { basis: 'bookingCreation', offsetDays: -14 },
      ),
    ).toBe(false);
  });

  it('treats null/undefined as equal to each other but not to a rule', () => {
    expect(dueDateRuleEqual(null, undefined)).toBe(true);
    expect(dueDateRuleEqual(null, { basis: 'bookingDate', offsetDays: 0 })).toBe(false);
  });
});

describe('sparsifySystemOverrides (ADR-0060 §3)', () => {
  const quoteDefault = () => {
    const item = CHECKLIST_DEFAULTS.find((d) => d.key === 'get_the_quote_accepted');
    if (!item) throw new Error('quote goal missing');
    return item;
  };

  it('drops an override that equals the catalogue default (enabled true + same dueDateRule)', () => {
    const result = sparsifySystemOverrides([
      { key: 'get_the_quote_accepted', enabled: true, dueDateRule: quoteDefault().dueDateRule },
    ]);
    expect(result).toEqual([]);
  });

  it('keeps a genuine enabled:false delta', () => {
    expect(sparsifySystemOverrides([{ key: 'get_deposit_paid', enabled: false }])).toEqual([
      { key: 'get_deposit_paid', enabled: false },
    ]);
  });

  it('keeps a changed dueDateRule but not one equal to the default', () => {
    expect(
      sparsifySystemOverrides([
        { key: 'get_the_quote_accepted', dueDateRule: { basis: 'bookingCreation', offsetDays: 5 } },
      ]),
    ).toEqual([
      { key: 'get_the_quote_accepted', dueDateRule: { basis: 'bookingCreation', offsetDays: 5 } },
    ]);
    expect(
      sparsifySystemOverrides([
        { key: 'get_the_quote_accepted', dueDateRule: quoteDefault().dueDateRule },
      ]),
    ).toEqual([]);
  });

  it('drops an override for a key the catalogue no longer has', () => {
    expect(sparsifySystemOverrides([{ key: 'confirm_quote', enabled: false }])).toEqual([]);
  });
});

describe('getChecklistDefaults read-merge (ADR-0060)', () => {
  const keys = (items: ChecklistDefaultItem[]) => items.map((i) => i.key);
  const withOverrides = (overrides: unknown) => ({ checklistDefaults: overrides });

  it('returns the pure catalogue when there are no stored preferences', () => {
    expect(getChecklistDefaults(null)).toEqual(CHECKLIST_DEFAULTS);
    expect(getChecklistDefaults({})).toEqual(CHECKLIST_DEFAULTS);
  });

  it('falls back to the catalogue for a legacy array blob (defensive, §7)', () => {
    const legacy = [{ key: 'send_quote', enabled: false, label: 'Send quote' }];
    expect(getChecklistDefaults(withOverrides(legacy))).toEqual(CHECKLIST_DEFAULTS);
  });

  it('falls back to the catalogue for a malformed blob without throwing', () => {
    expect(getChecklistDefaults(withOverrides('nonsense'))).toEqual(CHECKLIST_DEFAULTS);
    expect(getChecklistDefaults(withOverrides(42))).toEqual(CHECKLIST_DEFAULTS);
  });

  it('applies an enabled:false override onto the matching goal only', () => {
    const merged = getChecklistDefaults(
      withOverrides({ systemItemOverrides: [{ key: 'get_deposit_paid', enabled: false }], customItems: [] }),
    );
    expect(merged.find((i) => i.key === 'get_deposit_paid')?.enabled).toBe(false);
    // every other goal stays at its catalogue default (not frozen)
    expect(merged.find((i) => i.key === 'get_the_quote_accepted')?.enabled).toBeUndefined();
    expect(keys(merged)).toEqual(keys(CHECKLIST_DEFAULTS));
  });

  it('applies a dueDateRule override onto the matching goal', () => {
    const rule = { basis: 'bookingDate' as const, offsetDays: -7 };
    const merged = getChecklistDefaults(
      withOverrides({ systemItemOverrides: [{ key: 'get_deposit_paid', dueDateRule: rule }], customItems: [] }),
    );
    expect(merged.find((i) => i.key === 'get_deposit_paid')?.dueDateRule).toEqual(rule);
  });

  it('drops an override for a retired key on read — no throw, catalogue intact', () => {
    const merged = getChecklistDefaults(
      withOverrides({ systemItemOverrides: [{ key: 'confirm_quote', enabled: false }], customItems: [] }),
    );
    expect(keys(merged)).toEqual(keys(CHECKLIST_DEFAULTS));
    expect(merged).toEqual(CHECKLIST_DEFAULTS);
  });

  it('inherits current catalogue steps for a goal the user has an override on (auto-inherit, not freeze)', () => {
    const merged = getChecklistDefaults(
      withOverrides({ systemItemOverrides: [{ key: 'get_deposit_paid', enabled: false }], customItems: [] }),
    );
    const catalogueDeposit = CHECKLIST_DEFAULTS.find((i) => i.key === 'get_deposit_paid');
    const mergedDeposit = merged.find((i) => i.key === 'get_deposit_paid');
    expect(mergedDeposit?.steps).toEqual(catalogueDeposit?.steps);
  });

  it('slots a custom item into its requiredForStatus stage', () => {
    const custom: ChecklistDefaultItem = {
      key: null as unknown as string,
      label: 'Arrange parking',
      completedBy: 'USER',
      dependsOn: [],
      autoCompleteRule: null,
      requiredForStatus: 'CONFIRMED',
      dueDateRule: null,
    };
    const merged = getChecklistDefaults(
      withOverrides({ systemItemOverrides: [], customItems: [custom] }),
    );
    const parkingIdx = merged.findIndex((i) => i.label === 'Arrange parking');
    const lastConfirmedIdx = merged.map((i) => i.requiredForStatus).lastIndexOf('CONFIRMED');
    const firstReadyIdx = merged.findIndex((i) => i.requiredForStatus === 'READY');
    // sits within the CONFIRMED cluster: after the last CONFIRMED goal is itself, before READY
    expect(parkingIdx).toBe(lastConfirmedIdx);
    expect(parkingIdx).toBeLessThan(firstReadyIdx);
  });

  it('places a null-stage custom item at the very top', () => {
    const custom: ChecklistDefaultItem = {
      key: null as unknown as string,
      label: 'Untagged todo',
      completedBy: 'USER',
      dependsOn: [],
      autoCompleteRule: null,
      requiredForStatus: null,
      dueDateRule: null,
    };
    const merged = getChecklistDefaults(
      withOverrides({ systemItemOverrides: [], customItems: [custom] }),
    );
    expect(merged[0].label).toBe('Untagged todo');
  });
});
