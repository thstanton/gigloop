import { LOGISTICS_TIME_KEYS } from '@/lib/constants';
import type {
  BookingDetail,
  BookingLogisticsEntry,
  UpdateBookingSeriesResponse,
} from '@/types/api';
import type { DetailsLogistics } from '@/features/bookings/DetailsAtom';
import type { CompletenessStatus, SpineId } from '@/features/bookings/builderCompleteness';

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
