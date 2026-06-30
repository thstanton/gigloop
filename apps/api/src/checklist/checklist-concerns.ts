// Single source of truth mapping each system checklist reminder (`key`) to the
// Builder/new-booking *concern* whose work it is about, and back (ADR-0052,
// PRD #538). The per-concern "Remind me about" control reads this to decide
// which system reminders belong in each section.
//
// Custom items do NOT live here — they carry a user-chosen `concern` stored on
// the item. This map is exclusively the system-key → concern authority.

// The concerns a reminder can belong to. A subset of the Builder spine (the
// spine also has templates/details/notes sections, which host no reminders).
export type ReminderConcern = 'overview' | 'people' | 'venue' | 'itinerary' | 'music';

// Every system `key` resolves to exactly one concern. Mapping rationale (ADR-0052 §2):
//   Venue / Itinerary / Music — the contextual structural items.
//   People — the outbound *sends* (things sent to a person).
//   Overview — the rest of the deal/billing spine plus the gig itself (catch-all,
//     coherent because Overview *is* the deal-level concern).
const KEY_TO_CONCERN: Record<string, ReminderConcern> = {
  // Venue / Itinerary / Music
  add_venue: 'venue',
  build_itinerary: 'itinerary',
  // ADR-0057 / #608: song requests are now one multi-step *goal* (invite → response). Its
  // outcome is musical, so the goal lives in 'music' (the invite step's old 'people' home
  // retires with the fold).
  gather_song_requests: 'music',
  // People — the sends
  send_thank_you: 'people',
  // Overview — deal spine + the gig
  // ADR-0057 / #616: the quote is now one multi-step *goal* (send → accepted). Its send step's
  // old 'people' home retires with the fold; the goal lives on the deal spine in 'overview'.
  get_the_quote_accepted: 'overview',
  // ADR-0057 / #607–#608: the contract, deposit and balance are each one multi-step *goal*.
  // Their create/send/signed/received steps are not independently toggleable reminders — the
  // goal is the unit. (The picker listing goals as the toggle unit is #609; here we just keep
  // the system-key authority pointing at the real goal key.)
  get_contract_signed: 'overview',
  get_deposit_paid: 'overview',
  get_the_balance_paid: 'overview',
  play_the_gig: 'overview',
};

/** The concern a system reminder `key` belongs to, or null if the key is unknown. */
export function concernForKey(key: string): ReminderConcern | null {
  return KEY_TO_CONCERN[key] ?? null;
}

/** The system reminder keys belonging to a concern, in template (workflow) order is
 *  not guaranteed here — callers that need ordering sort against the defaults catalog. */
export function keysForConcern(concern: ReminderConcern): string[] {
  return Object.keys(KEY_TO_CONCERN).filter((key) => KEY_TO_CONCERN[key] === concern);
}
