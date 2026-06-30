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
    // ADR-0057 / #607–#608: the contract, deposit, balance and song-request deliverables are each
    // one multi-step *goal* — their create/send/issue/received/invite/response steps are no longer
    // independent reminder keys. People holds only the standalone sends; the multi-step billing
    // goals live in Overview; the song-request goal's outcome is musical so it lives in Music.
    expect(keysForConcern('people').sort(alpha)).toEqual(
      ['send_quote', 'send_thank_you'].sort(alpha),
    );
    expect(keysForConcern('venue')).toEqual(['add_venue']);
    expect(keysForConcern('itinerary')).toEqual(['build_itinerary']);
    expect(keysForConcern('music')).toEqual(['gather_song_requests']);
    expect(keysForConcern('overview').sort(alpha)).toEqual(
      [
        'confirm_quote',
        'get_deposit_paid',
        'get_contract_signed',
        'invoice_the_balance',
        'play_the_gig',
      ].sort(alpha),
    );
  });
});
