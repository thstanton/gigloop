import { CHECKLIST_DEFAULTS } from '../bookings/checklist-defaults';
import { concernForKey, keysForConcern, ReminderConcern } from './checklist-concerns';

const ALL_CONCERNS: ReminderConcern[] = ['overview', 'people', 'venue', 'itinerary', 'music'];
const alpha = (a: string, b: string) => a.localeCompare(b);

// Every system reminder is a CHECKLIST_DEFAULTS entry; their keys are non-null.
const SYSTEM_KEYS: string[] = CHECKLIST_DEFAULTS.map((d) => d.key);

describe('checklist concern map', () => {
  it('resolves every system key to exactly one concern (no orphan keys)', () => {
    for (const key of SYSTEM_KEYS) {
      const concern = concernForKey(key);
      expect(concern).not.toBeNull();
      expect(ALL_CONCERNS).toContain(concern);
    }
  });

  it('inverse (keysForConcern) covers all system keys with no duplicates', () => {
    const covered = ALL_CONCERNS.flatMap((c) => keysForConcern(c));
    // Every default key is covered exactly once across all concerns.
    expect(covered.slice().sort(alpha)).toEqual(SYSTEM_KEYS.slice().sort(alpha));
    expect(new Set(covered).size).toBe(covered.length);
  });

  it('maps each system key back to the concern that claims it', () => {
    for (const concern of ALL_CONCERNS) {
      for (const key of keysForConcern(concern)) {
        expect(concernForKey(key)).toBe(concern);
      }
    }
  });

  it('returns null for an unknown key', () => {
    expect(concernForKey('not_a_real_key')).toBeNull();
  });

  it('groups the sends under People and the deal spine under Overview', () => {
    expect(keysForConcern('people').sort(alpha)).toEqual(
      ['music_form_invite', 'send_contract', 'send_quote', 'send_thank_you'].sort(alpha),
    );
    expect(keysForConcern('venue')).toEqual(['add_venue']);
    expect(keysForConcern('itinerary')).toEqual(['build_itinerary']);
    expect(keysForConcern('music')).toEqual(['song_requests']);
    expect(keysForConcern('overview').sort(alpha)).toEqual(
      [
        'confirm_quote',
        'create_deposit_invoice',
        'create_contract',
        'contract_signed',
        'deposit_received',
        'create_balance_invoice',
        'play_the_gig',
      ].sort(alpha),
    );
  });
});
