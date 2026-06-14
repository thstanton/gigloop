import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { apiGet } from '@/lib/api';
import type { BookingListItem, BookingStatus } from '@/types/api';

interface BookingsQueryParams {
  /** Statuses to request. Empty array = no filter (all statuses returned by the API). */
  statuses: BookingStatus[];
}

export function useBookings({ statuses }: BookingsQueryParams) {
  const { isLoaded } = useAuth();

  return useQuery({
    queryKey: ['bookings', [...statuses].sort((a, b) => a.localeCompare(b))],
    queryFn: () => {
      const search = statuses.map((s) => `status=${s}`).join('&');
      return apiGet<BookingListItem[]>(search ? `/bookings?${search}` : '/bookings');
    },
    enabled: isLoaded,
  });
}
