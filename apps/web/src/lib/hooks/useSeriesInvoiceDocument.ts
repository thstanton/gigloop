import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { apiGetNullable } from '@/lib/api';
import type { InvoiceDocument, Invoice } from '@/types/api';

/**
 * The stored PDF backing an issued series invoice (#830).
 *
 * A series invoice's Document has no `bookingId`, so it appears in no booking's document list —
 * this is the only way the client learns its id, and from there the access-controlled
 * `/documents/:id/download` route (ADR-0059). Without it the PDF is generated, stored and emailed
 * to the client, but the musician has no route to it.
 *
 * Disabled for a DRAFT: no PDF exists until issue, and the endpoint would simply 404. The draft
 * case is served by the regenerating preview endpoint instead.
 */
export function useSeriesInvoiceDocument(
  seriesId: string | null | undefined,
  invoice: Invoice | null | undefined,
) {
  const { isLoaded } = useAuth();
  const invoiceId = invoice?.id;
  const hasStoredPdf = !!invoice && invoice.status !== 'DRAFT';
  return useQuery({
    queryKey: ['seriesInvoiceDocument', seriesId, invoiceId],
    queryFn: () =>
      apiGetNullable<InvoiceDocument>(`/invoices/${invoiceId}/document`),
    enabled: isLoaded && !!seriesId && !!invoiceId && hasStoredPdf,
  });
}
