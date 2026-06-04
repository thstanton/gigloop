import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { apiGet } from '@/lib/api';
import type { BookingListItem } from '@/types/api';

export function useSeriesBookings(seriesId: string | null | undefined) {
  const { isLoaded } = useAuth();
  return useQuery({
    queryKey: ['series', seriesId, 'bookings'],
    queryFn: () => apiGet<BookingListItem[]>(`/series/${seriesId}/bookings`),
    enabled: isLoaded && !!seriesId,
  });
}
