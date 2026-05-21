import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { apiGet } from '@/lib/api';
import type { Invoice } from '@/types/api';

export function useBookingInvoices(bookingId: string) {
  const { isLoaded } = useAuth();
  return useQuery({
    queryKey: ['bookingInvoices', bookingId],
    queryFn: () => apiGet<Invoice[]>(`/bookings/${bookingId}/invoices`),
    enabled: isLoaded && !!bookingId,
  });
}
