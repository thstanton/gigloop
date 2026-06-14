import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { apiGet } from '@/lib/api';
import type { BookingListItem, BookingStatus } from '@/types/api';

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
