// Module A (PRD #511) — booking completeness predicates.
//
// The single source of truth mapping a Booking to per-concern completeness status.
// Both the checklist auto-complete evaluator (via the `completeness` autoCompleteRule)
// and — in a later slice — the Builder's completeness rail derive "is this concern done?"
// from here. They must never compute it independently. This mirrors the discipline the
// cross-booking surfacing filter already uses: one rule, shared by two surfaces, kept from
// diverging (see checklist-surfacing.ts and CONTEXT [[BookingChecklist]]).
//
// Each concern slice (#516 venue, #523 itinerary, …) registers its predicate here rather
// than this module being stood up as one block.

/** Venue completeness: a venue is either chosen or it isn't. Keyed off `venueId`. */
export type VenueCompleteness = 'set' | 'unset';

export interface VenueInput {
  venueId: string | null;
}

export function venueCompleteness(booking: VenueInput): VenueCompleteness {
  return booking.venueId != null ? 'set' : 'unset';
}

/** The concerns a structural checklist item can bind to. Grows one entry per slice. */
export type CompletenessConcern = 'venue';

// The booking shape covering every concern's predicate inputs. The checklist evaluator
// selects exactly these fields from the booking; this union grows as concerns are added.
export type CompletenessInput = VenueInput;

// The binding point for `{ type: 'completeness', concern }` autoCompleteRules: returns
// whether the concern's done-state is satisfied. Defined in terms of the rich predicates
// above, so the boolean the evaluator reads and the status the rail reads can never disagree.
export function isConcernComplete(
  concern: CompletenessConcern,
  booking: CompletenessInput,
): boolean {
  if (concern === 'venue') return venueCompleteness(booking) === 'set';
  // Compile-time exhaustiveness: adding a concern without a branch here is a type error.
  const unhandled: never = concern;
  throw new Error(`Unhandled completeness concern: ${String(unhandled)}`);
}
