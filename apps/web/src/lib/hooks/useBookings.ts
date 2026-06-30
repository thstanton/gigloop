import { useQuery, type QueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { apiGet } from '@/lib/api';
import type { BookingDetail, BookingListItem, BookingStatus } from '@/types/api';

interface BookingsQueryParams {
  /** Statuses to request. Empty array = no filter (all statuses returned by the API). */
  statuses: BookingStatus[];
  /** Free-text search term. Omit or pass undefined to skip search filtering. */
  q?: string;
  /** Event type equality filter (e.g. 'WEDDING'). Omit to return all event types. */
  eventType?: string;
  /** Lower bound for booking date (ISO date string, e.g. '2026-04-06'). */
  from?: string;
  /** Upper bound for booking date (ISO date string, e.g. '2027-04-05'). */
  to?: string;
}

// Project a full booking (the shape the PATCH endpoints return) down to the lean list-row
// shape the list query caches (#588). Anything not on BookingListItem — logistics, notes,
// packages, the full Contact objects — is dropped here.
function toListItem(b: BookingDetail): BookingListItem {
  return {
    id: b.id,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    status: b.status,
    eventType: b.eventType,
    date: b.date,
    title: b.title,
    fee: b.fee,
    customerId: b.customerId,
    customer: { id: b.customer.id, name: b.customer.name, email: b.customer.email },
    venueId: b.venueId,
    venue: b.venue ? { id: b.venue.id, name: b.venue.name } : null,
    bookingAgentId: b.bookingAgentId,
    bookingAgent: b.bookingAgent ? { id: b.bookingAgent.id, name: b.bookingAgent.name } : null,
    sets: b.sets.slice(0, 1).map((s) => ({ startTime: s.startTime })),
    seriesId: b.seriesId,
    series: b.series ? { id: b.series.id, label: b.series.label } : null,
  };
}

// Splice an updated booking into every cached ['bookings', …] permutation in place, instead of
// invalidating the whole list and refetching every filter/search permutation (#590). The list
// query's staleTime-0 refetch on next mount self-corrects membership when a status change moves
// a booking between status-filtered buckets, so an in-place row update is safe here.
export function updateBookingInListCaches(queryClient: QueryClient, booking: BookingDetail) {
  const lean = toListItem(booking);
  queryClient.setQueriesData<BookingListItem[]>({ queryKey: ['bookings'] }, (old) =>
    old?.map((b) => (b.id === lean.id ? lean : b)),
  );
}

export function useBookings({ statuses, q, eventType, from, to }: BookingsQueryParams) {
  const { isLoaded } = useAuth();

  return useQuery({
    queryKey: ['bookings', [...statuses].sort((a, b) => a.localeCompare(b)), q ?? '', eventType ?? '', from ?? '', to ?? ''],
    queryFn: () => {
      const params = new URLSearchParams();
      statuses.forEach((s) => params.append('status', s));
      if (q) params.set('q', q);
      if (eventType) params.set('eventType', eventType);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const qs = params.toString();
      return apiGet<BookingListItem[]>(qs ? `/bookings?${qs}` : '/bookings');
    },
    enabled: isLoaded,
  });
}
