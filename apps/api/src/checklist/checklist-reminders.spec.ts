import {
  selectApplicableReminders,
  ReminderItemInput,
  ApplicableReminder,
} from './checklist-reminders';

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
  });
});
