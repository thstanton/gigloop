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
}

export function useBookings({ statuses, q, eventType }: BookingsQueryParams) {
  const { isLoaded } = useAuth();

  return useQuery({
    queryKey: ['bookings', [...statuses].sort((a, b) => a.localeCompare(b)), q ?? '', eventType ?? ''],
    queryFn: () => {
      const params = new URLSearchParams();
      statuses.forEach((s) => params.append('status', s));
      if (q) params.set('q', q);
      if (eventType) params.set('eventType', eventType);
      const qs = params.toString();
      return apiGet<BookingListItem[]>(qs ? `/bookings?${qs}` : '/bookings');
    },
    enabled: isLoaded,
  });
}
