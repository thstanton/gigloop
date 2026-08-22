import { LOGISTICS_TIME_KEYS } from '@/lib/constants';
import type {
  BookingDetail,
  BookingLogisticsEntry,
  MusicFormSuggestion,
  UpdateBookingSeriesResponse,
} from '@/types/api';
import type { DetailsLogistics } from '@/features/bookings/DetailsAtom';
import type { CompletenessStatus, SpineId } from '@/features/bookings/builderCompleteness';
import { SPINE } from '@/features/bookings/builderSpine';
import type { StepperSection } from '@/features/bookings/MobileBuilderStepper';

// ─── Shared logistics helpers (mirror QuickTweakSheet seams) ─────────────────

export function nonAnchorKeys(logistics: BookingDetail['logistics']): Record<string, BookingLogisticsEntry> {
  const anchors = new Set<string>(LOGISTICS_TIME_KEYS);
  return Object.fromEntries(Object.entries(logistics ?? {}).filter(([k]) => !anchors.has(k)));
}

export function preservedTimeKeys(logistics: BookingDetail['logistics']): DetailsLogistics {
  const out: DetailsLogistics = {};
  for (const key of LOGISTICS_TIME_KEYS) {
    const entry = logistics?.[key];
    if (entry) out[key] = entry;
  }
  return out;
}

export function pluralPackages(n: number): string {
  return `${n} ${n === 1 ? 'package' : 'packages'}`;
}

export function isConfirmationRequired(r: unknown): r is Required<UpdateBookingSeriesResponse> {
  return Boolean(r && typeof r === 'object' && 'requiresConfirmation' in r);
}

// A package-template apply response is only worth surfacing as a suggestion
// banner if it actually suggests something.
export function hasSuggestionContent(s: MusicFormSuggestion): boolean {
  return s.keyMoments.length > 0 || s.genres.length > 0;
}

// The Itinerary row actions each need "which row is this mutation currently
// busy with" — null once it's not pending, otherwise a bit of its variables
// (a set id, a package id...). One helper for the shape instead of a
// isPending-ternary at every call site.
export function pendingVariable<V, T>(
  mutation: { isPending: boolean; variables?: V },
  select: (variables: V) => T,
): T | null {
  return mutation.isPending && mutation.variables !== undefined ? select(mutation.variables) : null;
}

// ─── Completeness (mirrors Module A predicates client-side) ──────────────────

function itineraryStatus(setCount: number, hasAllAnchors: boolean): CompletenessStatus {
  if (setCount === 0) return 'empty';
  return hasAllAnchors ? 'set' : 'partial';
}

export function buildCompletenessMap(booking: BookingDetail): Record<SpineId, CompletenessStatus> {
  const hasAllAnchors = (['arrivalTime', 'soundCheckTime', 'finishTime'] as const)
    .every((k) => !!booking.logistics?.[k]?.value);
  return {
    overview:   null,
    people:     booking.customer ? 'set' : 'unset',
    venue:      booking.venue ? 'set' : 'unset',
    templates:  null,
    itinerary:  itineraryStatus(booking.sets.length, hasAllAnchors),
    details:    null,
    music:      null,
    notes:      null,
  };
}

function isUndone(status: CompletenessStatus): boolean {
  return status === 'unset' || status === 'empty';
}

// The completeness rail, the mobile stepper and the exit-backstop dialog all
// derive their section lists from the same completeness map — one place to
// keep the "which sections still need attention" and "what does the stepper
// show" derivations in sync with each other and with the spine order.
export function deriveBuilderNav(completeness: Record<SpineId, CompletenessStatus>): {
  undone: Array<{ id: SpineId; label: string }>;
  stepperSections: StepperSection[];
} {
  return {
    undone: SPINE.filter(({ id }) => isUndone(completeness[id])),
    stepperSections: SPINE.map(({ id, label }) => ({ id, label, status: completeness[id] })),
  };
}
