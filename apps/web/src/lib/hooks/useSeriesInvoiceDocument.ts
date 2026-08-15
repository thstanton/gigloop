import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { apiGet } from '@/lib/api';
import type { SeriesInvoiceDocument } from '@/types/api';

// The stored PDF document for a series invoice, keyed by invoice id. Null for a DRAFT (no
// document until issue). The document has no bookingId, so it appears in no Documents card —
// this is the client's only way to learn its download url (TIM-42). Keyed so the issue-time
// invalidation in invoiceActionRouting (`['seriesInvoiceDocument', seriesId]`) refetches it.
export function useSeriesInvoiceDocument(
  seriesId: string | null | undefined,
  invoiceId: string | null | undefined,
) {
  const { isLoaded } = useAuth();
  return useQuery({
    queryKey: ['seriesInvoiceDocument', seriesId, invoiceId],
    queryFn: () =>
      apiGet<SeriesInvoiceDocument | null>(`/series/${seriesId}/invoices/${invoiceId}/document`),
    enabled: isLoaded && !!seriesId && !!invoiceId,
  });
}
