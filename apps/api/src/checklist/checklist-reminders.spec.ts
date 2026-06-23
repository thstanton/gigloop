import {
  selectApplicableReminders,
  ReminderItemInput,
  ApplicableReminder,
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
      expect(keys(out)).toEqual(['send_quote', 'send_contract', 'music_form_invite', 'send_thank_you']);
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
        'create_contract',
        'contract_signed',
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
        disabledKeys: new Set(['send_contract']),
      });
      expect(find(out, 'send_contract')).toBeUndefined();
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
      expect(find(selectApplicableReminders('overview', ctx), 'contract_signed')?.autoCompleteHint).toBe(
        'when the client signs in the portal',
      );
      expect(find(selectApplicableReminders('music', ctx), 'song_requests')?.autoCompleteHint).toBe(
        'when the client sends their requests',
      );
    });

    it('leaves the self-evident Send/Create items without a hint', () => {
      const people = selectApplicableReminders('people', ctx);
      expect(find(people, 'send_quote')?.autoCompleteHint).toBeNull();
      expect(find(people, 'send_contract')?.autoCompleteHint).toBeNull();
      expect(find(selectApplicableReminders('overview', ctx), 'create_deposit_invoice')?.autoCompleteHint).toBeNull();
    });
  });

  describe('dependency clause — after (#557/#558)', () => {
    // send_contract (people concern) depends on create_contract; drive create_contract's state.
    const sendContractAfter = (createContractState?: string) => {
      const items = createContractState
        ? [item({ id: 'cc', key: 'create_contract', state: createContractState })]
        : [];
      const out = selectApplicableReminders('people', { items, status: 'CONFIRMED', disabledKeys: new Set() });
      return find(out, 'send_contract')?.after;
    };

    it.each(['PENDING', 'BLOCKED', 'FAILED'])(
      'shows the clause while the prerequisite is outstanding (%s)',
      (state) => {
        expect(sendContractAfter(state)).toBe('create the contract');
      },
    );

    it.each(['COMPLETE', 'SKIPPED'])('hides the clause once the prerequisite is %s', (state) => {
      expect(sendContractAfter(state)).toBeNull();
    });

    it('hides the clause when the prerequisite is absent (never seeded)', () => {
      expect(sendContractAfter()).toBeNull();
    });

    it('stacks with the auto-complete hint on a client-committed reminder', () => {
      // contract_signed (overview) gated by an outstanding send_contract → both fields populated.
      const out = selectApplicableReminders('overview', {
        items: [item({ id: 'sc', key: 'send_contract', state: 'PENDING' })],
        status: 'CONFIRMED',
        disabledKeys: new Set(),
      });
      const cs = find(out, 'contract_signed');
      expect(cs?.after).toBe('send the contract');
      expect(cs?.autoCompleteHint).toBe('when the client signs in the portal');
    });

    it('every prerequisite key referenced in a dependsOn has an action phrase (no silent drop)', () => {
      const prereqKeys = new Set(CHECKLIST_DEFAULTS.flatMap((d) => d.dependsOn));
      for (const key of prereqKeys) {
        expect(PREREQUISITE_PHRASES[key]).toBeDefined();
      }
    });
  });
});
