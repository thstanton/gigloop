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

/**
 * People completeness: keyed off the customer (the required anchor of the People concern;
 * the booking agent is genuinely optional, so its absence never makes People incomplete).
 * A persisted booking always has a customer, so this reads `set` post-creation — the `unset`
 * state exists for the pre-commit create flow, where the customer isn't chosen yet.
 */
export type PeopleCompleteness = 'set' | 'unset';

export interface PeopleInput {
  customerId: string | null;
}

export function peopleCompleteness(booking: PeopleInput): PeopleCompleteness {
  return booking.customerId != null ? 'set' : 'unset';
}

/**
 * Itinerary completeness: three-state — `empty` (no sets), `partial` (sets exist but not
 * all time anchors present), `set` (sets + all three time anchors). Keyed off `setsCount`
 * and the `logistics` JSON (arrivalTime, soundCheckTime, finishTime).
 *
 * `isConcernComplete` returns true for any non-empty state — "sets exist" is the
 * done-threshold for `build_itinerary` (PRD #511 Story 21).
 */
export type ItineraryCompleteness = 'empty' | 'partial' | 'set';

export interface ItineraryInput {
  setsCount: number;
  logistics: unknown;
}

export function itineraryCompleteness(booking: ItineraryInput): ItineraryCompleteness {
  if (booking.setsCount === 0) return 'empty';
  const l = booking.logistics as Record<string, unknown> | null;
  const allAnchors = l?.arrivalTime != null && l?.soundCheckTime != null && l?.finishTime != null;
  return allAnchors ? 'set' : 'partial';
}

/** The concerns a structural checklist item can bind to. Grows one entry per slice. */
export type CompletenessConcern = 'venue' | 'people' | 'itinerary';

// The booking shape covering every concern's predicate inputs. The checklist evaluator
// selects exactly these fields from the booking; this union grows as concerns are added.
export type CompletenessInput = VenueInput & PeopleInput & ItineraryInput;

// The binding point for `{ type: 'completeness', concern }` autoCompleteRules: returns
// whether the concern's done-state is satisfied. Defined in terms of the rich predicates
// above, so the boolean the evaluator reads and the status the rail reads can never disagree.
export function isConcernComplete(
  concern: CompletenessConcern,
  booking: CompletenessInput,
): boolean {
  switch (concern) {
    case 'venue':
      return venueCompleteness(booking) === 'set';
    case 'people':
      return peopleCompleteness(booking) === 'set';
    case 'itinerary':
      return itineraryCompleteness(booking) !== 'empty';
    default: {
      // Compile-time exhaustiveness: adding a concern without a branch here is a type error.
      const unhandled: never = concern;
      throw new Error(`Unhandled completeness concern: ${String(unhandled)}`);
    }
  }
}
