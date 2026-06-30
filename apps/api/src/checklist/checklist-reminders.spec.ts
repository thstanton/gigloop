import {
  selectApplicableReminders,
  previewApplicableReminders,
  ReminderItemInput,
  ApplicableReminder,
  ReminderPreview,
  PREREQUISITE_PHRASES,
} from './checklist-reminders';
import { CHECKLIST_DEFAULTS } from '../bookings/checklist-defaults';

function item(overrides: Partial<ReminderItemInput> = {}): ReminderItemInput {
  return {
    id: 'i-' + (overrides.key ?? overrides.id ?? 'x'),
    key: null,
    state: 'PENDING',
    requiredForStatus: null,
    concern: null,
    label: 'Item',
    order: 1,
    ...overrides,
  };
}

const find = (out: ApplicableReminder[], key: string) => out.find((r) => r.key === key);
const keys = (out: ApplicableReminder[]) => out.map((r) => r.key);

describe('selectApplicableReminders', () => {
  describe('system reminders — stage gate', () => {
    it('excludes past-stage reminders (quote on a READY booking)', () => {
      // send_quote is PROVISIONAL-staged; a READY booking has passed it.
      const out = selectApplicableReminders('people', {
        items: [],
        status: 'READY',
        disabledKeys: new Set(),
      });
      expect(find(out, 'send_quote')).toBeUndefined();
    });

    it('includes current-and-future reminders (send_thank_you on a READY booking)', () => {
      const out = selectApplicableReminders('people', {
        items: [],
        status: 'READY',
        disabledKeys: new Set(),
      });
      // ADR-0057 / #608: music_form_invite and send_balance_invoice are now *steps* of the
      // gather_song_requests / invoice_the_balance goals, so People holds only the standalone
      // sends. send_thank_you (COMPLETE stage) is the future People reminder on a READY booking.
      expect(keys(out)).toEqual(['send_thank_you']);
    });

    it('includes all People sends on an ENQUIRY booking, in template order', () => {
      const out = selectApplicableReminders('people', {
        items: [],
        status: 'ENQUIRY',
        disabledKeys: new Set(),
      });
      // ADR-0057 / #616: the quote is now a multi-step goal in Overview (its send_quote step's old
      // People home retires with the fold), so send_thank_you is the only standalone People send.
      expect(keys(out)).toEqual(['send_thank_you']);
      // The collapsed quote goal lives in Overview now — it must not leak back into People.
      expect(find(out, 'get_the_quote_accepted')).toBeUndefined();
    });

    it('shows the future Overview deal spine on an ENQUIRY booking, in template order', () => {
      const out = selectApplicableReminders('overview', {
        items: [],
        status: 'ENQUIRY',
        disabledKeys: new Set(),
      });
      // ADR-0057 / #607–#608 / #616: the quote, contract, deposit and balance are each one
      // multi-step goal; the quote goal leads the spine.
      expect(keys(out)).toEqual([
        'get_the_quote_accepted',
        'get_deposit_paid',
        'get_contract_signed',
        'invoice_the_balance',
        'play_the_gig',
      ]);
    });

    it('drops past-stage Overview reminders on a READY booking, keeping the current and future stages', () => {
      // get_the_quote_accepted (PROVISIONAL) and the CONFIRMED-stage goals (get_deposit_paid,
      // get_contract_signed) are passed by a READY booking; invoice_the_balance (READY, current)
      // and play_the_gig (COMPLETE, future) remain.
      const out = selectApplicableReminders('overview', {
        items: [],
        status: 'READY',
        disabledKeys: new Set(),
      });
      expect(find(out, 'get_the_quote_accepted')).toBeUndefined();
      expect(keys(out)).toEqual(['invoice_the_balance', 'play_the_gig']);
    });
  });

  describe('system reminders — global disable', () => {
    it('excludes a globally-disabled key', () => {
      // Overview carries several goals, so disabling one leaves its siblings to assert against.
      const out = selectApplicableReminders('overview', {
        items: [],
        status: 'ENQUIRY',
        disabledKeys: new Set(['get_deposit_paid']),
      });
      expect(find(out, 'get_deposit_paid')).toBeUndefined();
      expect(find(out, 'get_the_quote_accepted')).toBeDefined();
    });
  });

  describe('system reminders — on/off + seeded state', () => {
    it('reads a not-yet-seeded reminder as off with no itemId (discoverable)', () => {
      const out = selectApplicableReminders('venue', {
        items: [],
        status: 'ENQUIRY',
        disabledKeys: new Set(),
      });
      const addVenue = find(out, 'add_venue');
      expect(addVenue).toMatchObject({ on: false, itemId: null, state: null, source: 'system' });
    });

    it('reads a seeded PENDING reminder as on, carrying its itemId and state', () => {
      const out = selectApplicableReminders('venue', {
        items: [item({ id: 'ci-venue', key: 'add_venue', state: 'PENDING', requiredForStatus: 'READY' })],
        status: 'ENQUIRY',
        disabledKeys: new Set(),
      });
      expect(find(out, 'add_venue')).toMatchObject({
        on: true,
        itemId: 'ci-venue',
        state: 'PENDING',
      });
    });

    it('reads a SKIPPED reminder as off but re-enableable (itemId present)', () => {
      const out = selectApplicableReminders('venue', {
        items: [item({ id: 'ci-venue', key: 'add_venue', state: 'SKIPPED', requiredForStatus: 'READY' })],
        status: 'ENQUIRY',
        disabledKeys: new Set(),
      });
      expect(find(out, 'add_venue')).toMatchObject({ on: false, itemId: 'ci-venue', state: 'SKIPPED' });
    });

    it('keeps a COMPLETE reminder on, exposing its lifecycle state within "on"', () => {
      const out = selectApplicableReminders('itinerary', {
        items: [item({ id: 'ci-it', key: 'build_itinerary', state: 'COMPLETE', requiredForStatus: 'READY' })],
        status: 'READY',
        disabledKeys: new Set(),
      });
      expect(find(out, 'build_itinerary')).toMatchObject({ on: true, state: 'COMPLETE' });
    });
  });

  describe('custom reminders', () => {
    it('includes a concern-tagged custom item, sourced as custom', () => {
      const out = selectApplicableReminders('venue', {
        items: [item({ id: 'cu1', key: null, concern: 'venue', label: 'Arrange parking', order: 5 })],
        status: 'ENQUIRY',
        disabledKeys: new Set(),
      });
      const custom = out.find((r) => r.itemId === 'cu1');
      expect(custom).toMatchObject({ source: 'custom', key: null, label: 'Arrange parking', on: true });
    });

    it('excludes a concern-less custom item from every concern', () => {
      const ctx = {
        items: [item({ id: 'cu2', key: null, concern: null, label: 'Untagged todo' })],
        status: 'ENQUIRY',
        disabledKeys: new Set<string>(),
      };
      for (const concern of ['overview', 'people', 'venue', 'itinerary', 'music'] as const) {
        expect(selectApplicableReminders(concern, ctx).some((r) => r.itemId === 'cu2')).toBe(false);
      }
    });

    it('excludes a custom tagged to a different concern', () => {
      const out = selectApplicableReminders('venue', {
        items: [item({ id: 'cu3', key: null, concern: 'music', label: 'Music note' })],
        status: 'ENQUIRY',
        disabledKeys: new Set(),
      });
      expect(out.some((r) => r.itemId === 'cu3')).toBe(false);
    });

    it('applies the stage gate to a staged custom item', () => {
      const out = selectApplicableReminders('venue', {
        items: [item({ id: 'cu4', key: null, concern: 'venue', requiredForStatus: 'PROVISIONAL' })],
        status: 'READY',
        disabledKeys: new Set(),
      });
      expect(out.some((r) => r.itemId === 'cu4')).toBe(false);
    });

    it('orders system reminders before customs', () => {
      const out = selectApplicableReminders('venue', {
        items: [item({ id: 'cu5', key: null, concern: 'venue', label: 'Custom', order: 9 })],
        status: 'ENQUIRY',
        disabledKeys: new Set(),
      });
      // add_venue (system) precedes the custom item.
      expect(out[0].key).toBe('add_venue');
      expect(out[out.length - 1].itemId).toBe('cu5');
    });

    it('a custom item never carries an auto-complete hint', () => {
      const out = selectApplicableReminders('venue', {
        items: [item({ id: 'cu6', key: null, concern: 'venue', label: 'Arrange parking' })],
        status: 'ENQUIRY',
        disabledKeys: new Set(),
      });
      expect(out.find((r) => r.itemId === 'cu6')?.autoCompleteHint).toBeNull();
    });
  });

  describe('auto-complete hint (#567)', () => {
    const ctx = { items: [], status: 'ENQUIRY', disabledKeys: new Set<string>() };

    it('gives multi-step goals no goal-level hint (the condition lives on their steps)', () => {
      // ADR-0057 / #607–#608: the client-committed milestones (contract signs, song requests
      // arrive, deposit lands) are now *steps*; the goal carries no own rule, so no goal-level
      // hint. The step-level condition is surfaced by the goal⊃step row UI (#609/#611).
      expect(find(selectApplicableReminders('music', ctx), 'gather_song_requests')?.autoCompleteHint).toBeNull();
      expect(find(selectApplicableReminders('overview', ctx), 'get_contract_signed')?.autoCompleteHint).toBeNull();
      expect(find(selectApplicableReminders('overview', ctx), 'get_deposit_paid')?.autoCompleteHint).toBeNull();
    });

    it('leaves the self-evident Send items without a hint', () => {
      // send_quote is a step of the quote goal now; send_thank_you is the standalone People send.
      const people = selectApplicableReminders('people', ctx);
      expect(find(people, 'send_thank_you')?.autoCompleteHint).toBeNull();
    });
  });

  describe('dependency clause — after (#557/#558)', () => {
    // send_thank_you (people) depends on play_the_gig (overview); drive the gig's state. The
    // intra-goal deps (e.g. confirm←send, song_requests→music_form_invite) retired with the
    // goal⊃step fold (ADR-0057: steps are intrinsically ordered); the quote's send→accepted
    // collapsed into one goal in #616, so this cross-concern dep is what remains.
    const thankYouAfter = (gigState?: string) => {
      const items = gigState ? [item({ id: 'ptg', key: 'play_the_gig', state: gigState })] : [];
      const out = selectApplicableReminders('people', { items, status: 'ENQUIRY', disabledKeys: new Set() });
      return find(out, 'send_thank_you')?.after;
    };

    it.each(['PENDING', 'FAILED'])(
      'shows the clause while the prerequisite is outstanding (%s)',
      (state) => {
        expect(thankYouAfter(state)).toBe('play the gig');
      },
    );

    it.each(['COMPLETE', 'SKIPPED'])('hides the clause once the prerequisite is %s', (state) => {
      expect(thankYouAfter(state)).toBeNull();
    });

    it('hides the clause when the prerequisite is absent (never seeded)', () => {
      expect(thankYouAfter()).toBeNull();
    });

    it('a multi-step goal carries no after-clause (its ordering is intrinsic to its steps)', () => {
      // gather_song_requests has dependsOn: [] — the invite→response order is intrinsic step
      // order now, not a dependency clause, and the goal carries no goal-level hint either.
      const out = selectApplicableReminders('music', {
        items: [item({ id: 'ptg', key: 'play_the_gig', state: 'PENDING' })],
        status: 'READY',
        disabledKeys: new Set(),
      });
      const goal = find(out, 'gather_song_requests');
      expect(goal?.after).toBeNull();
      expect(goal?.autoCompleteHint).toBeNull();
    });

    it('every prerequisite key referenced in a dependsOn has an action phrase (no silent drop)', () => {
      const prereqKeys = new Set(CHECKLIST_DEFAULTS.flatMap((d) => d.dependsOn));
      for (const key of prereqKeys) {
        expect(PREREQUISITE_PHRASES[key]).toBeDefined();
      }
    });
  });
});

const pfind = (out: ReminderPreview[], key: string) => out.find((r) => r.key === key);

describe('previewApplicableReminders (pre-creation, #560)', () => {
  it('offers every in-scope system key, each tagged with its concern', () => {
    const out = previewApplicableReminders({ status: 'PROVISIONAL', disabledKeys: new Set() });
    // A PROVISIONAL-starting booking still has every CONFIRMED+ reminder ahead of it.
    expect(pfind(out, 'gather_song_requests')?.concern).toBe('music');
    expect(pfind(out, 'get_contract_signed')?.concern).toBe('overview');
    expect(pfind(out, 'add_venue')?.concern).toBe('venue');
    expect(pfind(out, 'play_the_gig')?.concern).toBe('overview');
    // Every offered row maps to a concern (no orphans).
    expect(out.every((r) => r.concern)).toBe(true);
  });

  it('preserves template (workflow) order', () => {
    const out = previewApplicableReminders({ status: 'ENQUIRY', disabledKeys: new Set() });
    const order = out.map((r) => CHECKLIST_DEFAULTS.findIndex((d) => d.key === r.key));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('applies the same past-stage filter as the Builder', () => {
    // get_the_quote_accepted is PROVISIONAL-staged; a CONFIRMED-starting booking has passed it.
    const out = previewApplicableReminders({ status: 'CONFIRMED', disabledKeys: new Set() });
    expect(pfind(out, 'get_the_quote_accepted')).toBeUndefined();
    expect(pfind(out, 'send_thank_you')).toBeDefined(); // COMPLETE-staged, still ahead
  });

  it('drops a disabled key entirely (master switch parity with the Builder)', () => {
    const out = previewApplicableReminders({ status: 'ENQUIRY', disabledKeys: new Set(['add_venue']) });
    expect(pfind(out, 'add_venue')).toBeUndefined();
  });

  it('surfaces cross-concern prerequisites with their phrases', () => {
    // send_thank_you (people) depends on play_the_gig (overview) — the clause must survive the
    // concern boundary, with the prereq key + phrase for the frontend to gate by selection.
    // (The quote's confirm←send dep collapsed into one goal in #616.)
    const out = previewApplicableReminders({ status: 'ENQUIRY', disabledKeys: new Set() });
    expect(pfind(out, 'send_thank_you')?.prerequisites).toContainEqual({
      key: 'play_the_gig',
      phrase: 'play the gig',
    });
  });

  it('only surfaces prerequisites that are themselves still in scope (no past-stage clause)', () => {
    // The in-scope filter must drop any prereq that has itself been filtered out as past-stage, so
    // a still-offered row never carries a dangling clause. (With the current catalogue the only
    // dependency is the COMPLETE-staged play_the_gig, so this guards the filter generically.)
    const out = previewApplicableReminders({ status: 'READY', disabledKeys: new Set() });
    const offeredKeys = new Set(out.map((r) => r.key));
    for (const row of out) {
      for (const prereq of row.prerequisites) {
        expect(offeredKeys.has(prereq.key)).toBe(true);
      }
    }
  });

  it('gives multi-step goals no goal-level hint in the preview either', () => {
    // ADR-0057 / #607–#608 / #616: client-committed conditions live on steps, not the goal — so
    // the preview row for a multi-step goal carries no goal-level hint, like the live selector.
    const out = previewApplicableReminders({ status: 'ENQUIRY', disabledKeys: new Set() });
    expect(pfind(out, 'gather_song_requests')?.autoCompleteHint).toBeNull();
    expect(pfind(out, 'get_contract_signed')?.autoCompleteHint).toBeNull();
    expect(pfind(out, 'get_the_quote_accepted')?.autoCompleteHint).toBeNull();
  });
});
