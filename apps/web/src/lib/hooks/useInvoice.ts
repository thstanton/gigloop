import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { apiGet } from '@/lib/api';
import type { Invoice } from '@/types/api';

/**
 * One invoice, resolved by its own id (ADR-0069). Use this — never a search of
 * `useBookingInvoices` — whenever a sheet or dialog acts on an invoice it was handed:
 * that list is booking-scoped, so a series invoice (`bookingId: null`) is by construction
 * absent from it, and the search silently yields `undefined` rather than erroring (#844).
 *
 * `gcTime: 0` is deliberate. Consumers gate a sheet's `open` on the resolved invoice, and
 * `InvoiceSheet` seeds its form only on the open transition — so a cached row served while
 * a refetch is still in flight would populate the form with stale values and never correct
 * itself. Dropping the entry once nothing observes it makes every open a real read.
 */
export function useInvoice(invoiceId: string | null | undefined) {
  const { isLoaded } = useAuth();
  return useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => apiGet<Invoice>(`/invoices/${invoiceId}`),
    enabled: isLoaded && !!invoiceId,
    gcTime: 0,
  });
}
