import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { apiGet } from '@/lib/api';
import type { Communication } from '@/types/api';

export function useBookingCommunications(bookingId: string) {
  const { isLoaded } = useAuth();
  return useQuery({
    queryKey: ['bookingCommunications', bookingId],
    queryFn: () => apiGet<Communication[]>(`/bookings/${bookingId}/communications`),
    enabled: isLoaded && !!bookingId,
  });
}
