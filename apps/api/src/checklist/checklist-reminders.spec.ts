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
      // music_form_invite (READY) and send_thank_you (COMPLETE stage) are current/future.
      expect(keys(out)).toEqual(expect.arrayContaining(['music_form_invite', 'send_thank_you']));
    });

    it('includes all People sends on an ENQUIRY booking, in template order', () => {
      const out = selectApplicableReminders('people', {
        items: [],
        status: 'ENQUIRY',
        disabledKeys: new Set(),
      });
      expect(keys(out)).toEqual([
        'send_quote',
        'send_balance_invoice',
        'music_form_invite',
        'send_thank_you',
      ]);
    });

    it('shows the future Overview deal spine on an ENQUIRY booking, in template order', () => {
      const out = selectApplicableReminders('overview', {
        items: [],
        status: 'ENQUIRY',
        disabledKeys: new Set(),
      });
      expect(keys(out)).toEqual([
        'confirm_quote',
        'create_deposit_invoice',
        'get_contract_signed',
        'deposit_received',
        'create_balance_invoice',
        'play_the_gig',
      ]);
    });

    it('drops past-stage Overview reminders on a READY booking, keeping the current and future stages', () => {
      // confirm_quote (PROVISIONAL) and the CONFIRMED-stage spine are passed by a READY booking;
      // create_balance_invoice (READY, current) and play_the_gig (COMPLETE, future) remain.
      const out = selectApplicableReminders('overview', {
        items: [],
        status: 'READY',
        disabledKeys: new Set(),
      });
      expect(find(out, 'confirm_quote')).toBeUndefined();
      expect(keys(out)).toEqual(['create_balance_invoice', 'play_the_gig']);
    });
  });

  describe('system reminders — global disable', () => {
    it('excludes a globally-disabled key', () => {
      const out = selectApplicableReminders('people', {
        items: [],
        status: 'ENQUIRY',
        disabledKeys: new Set(['send_balance_invoice']),
      });
      expect(find(out, 'send_balance_invoice')).toBeUndefined();
      expect(find(out, 'send_quote')).toBeDefined();
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

    it('surfaces the condition for the client-committed milestones', () => {
      expect(find(selectApplicableReminders('music', ctx), 'song_requests')?.autoCompleteHint).toBe(
        'when the client sends their requests',
      );
      // The contract is now a multi-step goal with no own rule (ADR-0057) → no goal-level hint;
      // its "when the client signs" condition lives on the contract_signed step, not the reminder.
      expect(find(selectApplicableReminders('overview', ctx), 'get_contract_signed')?.autoCompleteHint).toBeNull();
    });

    it('leaves the self-evident Send/Create items without a hint', () => {
      const people = selectApplicableReminders('people', ctx);
      expect(find(people, 'send_quote')?.autoCompleteHint).toBeNull();
      expect(find(people, 'send_balance_invoice')?.autoCompleteHint).toBeNull();
      expect(find(selectApplicableReminders('overview', ctx), 'create_deposit_invoice')?.autoCompleteHint).toBeNull();
    });
  });

  describe('dependency clause — after (#557/#558)', () => {
    // song_requests (music concern) depends on music_form_invite (people); drive the invite's state.
    const songRequestsAfter = (inviteState?: string) => {
      const items = inviteState
        ? [item({ id: 'mfi', key: 'music_form_invite', state: inviteState })]
        : [];
      const out = selectApplicableReminders('music', { items, status: 'READY', disabledKeys: new Set() });
      return find(out, 'song_requests')?.after;
    };

    it.each(['PENDING', 'BLOCKED', 'FAILED'])(
      'shows the clause while the prerequisite is outstanding (%s)',
      (state) => {
        expect(songRequestsAfter(state)).toBe('send the music form invite');
      },
    );

    it.each(['COMPLETE', 'SKIPPED'])('hides the clause once the prerequisite is %s', (state) => {
      expect(songRequestsAfter(state)).toBeNull();
    });

    it('hides the clause when the prerequisite is absent (never seeded)', () => {
      expect(songRequestsAfter()).toBeNull();
    });

    it('stacks with the auto-complete hint on a client-committed reminder', () => {
      // song_requests (music) gated by an outstanding music_form_invite → both fields populated.
      const out = selectApplicableReminders('music', {
        items: [item({ id: 'mfi', key: 'music_form_invite', state: 'PENDING' })],
        status: 'READY',
        disabledKeys: new Set(),
      });
      const sr = find(out, 'song_requests');
      expect(sr?.after).toBe('send the music form invite');
      expect(sr?.autoCompleteHint).toBe('when the client sends their requests');
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
    expect(pfind(out, 'music_form_invite')?.concern).toBe('people');
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
    // send_quote is PROVISIONAL-staged; a CONFIRMED-starting booking has passed it.
    const out = previewApplicableReminders({ status: 'CONFIRMED', disabledKeys: new Set() });
    expect(pfind(out, 'send_quote')).toBeUndefined();
    expect(pfind(out, 'send_thank_you')).toBeDefined(); // COMPLETE-staged, still ahead
  });

  it('drops a disabled key entirely (master switch parity with the Builder)', () => {
    const out = previewApplicableReminders({ status: 'ENQUIRY', disabledKeys: new Set(['add_venue']) });
    expect(pfind(out, 'add_venue')).toBeUndefined();
  });

  it('surfaces cross-concern prerequisites with their phrases', () => {
    // song_requests (music) depends on music_form_invite (people) — the clause must survive the
    // concern boundary, with the prereq key + phrase for the frontend to gate by selection.
    const out = previewApplicableReminders({ status: 'PROVISIONAL', disabledKeys: new Set() });
    expect(pfind(out, 'song_requests')?.prerequisites).toContainEqual({
      key: 'music_form_invite',
      phrase: 'send the music form invite',
    });
  });

  it('omits a prerequisite that has itself been filtered out as past-stage', () => {
    // On a READY-starting booking, send_quote (PROVISIONAL-staged) has passed, so no still-ahead
    // dependent may carry a clause pointing at it. (Post-#607 the contract is one goal, so this
    // now guards the general past-stage-prereq filter rather than the old contract chain.)
    const out = previewApplicableReminders({ status: 'READY', disabledKeys: new Set() });
    for (const row of out) {
      expect(row.prerequisites.map((p) => p.key)).not.toContain('send_quote');
    }
  });

  it('carries the auto-complete hint for client-committed milestones', () => {
    const out = previewApplicableReminders({ status: 'ENQUIRY', disabledKeys: new Set() });
    expect(pfind(out, 'song_requests')?.autoCompleteHint).toBe('when the client sends their requests');
    expect(pfind(out, 'send_quote')?.autoCompleteHint).toBeNull();
  });
});
