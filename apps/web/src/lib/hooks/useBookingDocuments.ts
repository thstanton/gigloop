import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { apiGet } from '@/lib/api';
import type { Document } from '@/types/api';

export function useBookingDocuments(bookingId: string) {
  const { isLoaded } = useAuth();
  return useQuery({
    queryKey: ['bookingDocuments', bookingId],
    queryFn: () => apiGet<Document[]>(`/bookings/${bookingId}/documents`),
    enabled: isLoaded && !!bookingId,
  });
}
