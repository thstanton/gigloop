import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { apiGet } from '@/lib/api';
import type { BookingListItem, BookingStatus } from '@/types/api';

type Filter = BookingStatus | 'ALL';

export function useBookings(filter: Filter) {
  const { isLoaded } = useAuth();

  return useQuery({
    queryKey: ['bookings', filter],
    queryFn: () => {
      const path = filter === 'ALL' ? '/bookings' : `/bookings?status=${filter}`;
      return apiGet<BookingListItem[]>(path);
    },
    enabled: isLoaded,
  });
}
