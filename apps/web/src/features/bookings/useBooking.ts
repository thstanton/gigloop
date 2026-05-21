import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { apiGet } from '@/lib/api';
import type { BookingDetail } from '@/types/api';

export function useBooking(id: string) {
  const { isLoaded } = useAuth();
  return useQuery({
    queryKey: ['booking', id],
    queryFn: () => apiGet<BookingDetail>(`/bookings/${id}`),
    enabled: isLoaded && !!id,
  });
}
