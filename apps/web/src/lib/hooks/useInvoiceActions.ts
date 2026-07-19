import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { apiPost, apiPostVoid, apiDelete } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { invoiceOwnerRoute, type InvoiceAction } from '@/lib/invoiceActionRouting';
import type { Invoice } from '@/types/api';

// One field-derived home for every invoice transition (ADR-0063 client mirror, #724).
// The owner FK on the invoice (bookingId vs seriesId) derives both the endpoint prefix
// and the query keys to invalidate, so the series-invoice and booking-invoice recipes —
// once duplicated across this hook and SeriesInvoiceCard's six inline mutations —
// collapse into one. A series invoice's booking-shaped side-effects no-op by construction.
//
// The hook takes no owner argument: each action takes the full invoice, so a single hook
// instance serves a *list* of invoices (a booking's deposit + balance) and a single series
// invoice alike. `useInvoiceActions(invoice)` was the issue's shorthand, but the booking
// container renders a list and can't call a hook per row — pending is tracked per invoice id
// instead. `create` is the one series-only action (no invoice exists yet to derive from).

// Booking success toasts, preserved from the pre-#724 hook. Series stays silent on success
// (parity); error copy is owner-neutral (the series variants dropped their 'series' qualifier).
const SUCCESS_TOAST: Partial<Record<InvoiceAction, string>> = {
  issue: 'Invoice created',
  markSent: 'Invoice marked as sent',
};
const ERROR_TOAST: Record<InvoiceAction, string> = {
  issue: 'Failed to create invoice',
  markSent: 'Failed to mark invoice as sent',
  markPaid: 'Failed to mark invoice as paid',
  void: 'Failed to void invoice',
  delete: 'Failed to delete invoice',
};

// The invoice id currently mutating, or null — lets a list highlight only the acting row.
function pendingId(mutation: UseMutationResult<unknown, unknown, Invoice>): string | null {
  return mutation.isPending ? (mutation.variables?.id ?? null) : null;
}

export function useInvoiceActions() {
  const queryClient = useQueryClient();

  function onSuccess(invoice: Invoice, action: InvoiceAction) {
    for (const queryKey of invoiceOwnerRoute(invoice, action).keys) {
      queryClient.invalidateQueries({ queryKey });
    }
    const success = SUCCESS_TOAST[action];
    if (success && !invoice.seriesId) toast({ title: success });
  }

  // Builds a mutation config (no hook call) — the shared mutate → invalidate → toast recipe,
  // parameterised only by the owner-derived endpoint. useMutation is called directly below to
  // keep the rules-of-hooks satisfied.
  const config = (action: InvoiceAction, path: string, call: (url: string) => Promise<unknown>) => ({
    mutationFn: (invoice: Invoice) => call(`${invoiceOwnerRoute(invoice, action).prefix}/${invoice.id}/${path}`),
    onSuccess: (_data: unknown, invoice: Invoice) => onSuccess(invoice, action),
    onError: () => toast({ title: ERROR_TOAST[action], variant: 'destructive' }),
  });

  const issueMutation = useMutation(config('issue', 'issue', (url) => apiPost(url, {})));
  const markSentMutation = useMutation(config('markSent', 'mark-sent', (url) => apiPost(url, {})));
  const markPaidMutation = useMutation(config('markPaid', 'mark-paid', (url) => apiPost(url, {})));
  const voidMutation = useMutation(config('void', 'void', (url) => apiPostVoid(url, {})));
  const deleteMutation = useMutation({
    mutationFn: (invoice: Invoice) => apiDelete(`${invoiceOwnerRoute(invoice, 'delete').prefix}/${invoice.id}`),
    onSuccess: (_data, invoice) => onSuccess(invoice, 'delete'),
    onError: () => toast({ title: ERROR_TOAST.delete, variant: 'destructive' }),
  });

  // Series-only: no invoice exists yet, so this derives from the seriesId directly.
  const createSeriesMutation = useMutation({
    mutationFn: (seriesId: string) => apiPost<Invoice>(`/series/${seriesId}/invoices`, {}),
    onSuccess: (_data, seriesId) => queryClient.invalidateQueries({ queryKey: ['seriesInvoice', seriesId] }),
    onError: () => toast({ title: 'Failed to create series invoice', variant: 'destructive' }),
  });

  return {
    issue: (invoice: Invoice) => issueMutation.mutate(invoice),
    issuingInvoiceId: pendingId(issueMutation),
    isIssuing: issueMutation.isPending,

    markSent: (invoice: Invoice) => markSentMutation.mutate(invoice),
    markingSentId: pendingId(markSentMutation),
    isMarkingSent: markSentMutation.isPending,

    markPaid: (invoice: Invoice) => markPaidMutation.mutate(invoice),
    markingPaidId: pendingId(markPaidMutation),
    isMarkingPaid: markPaidMutation.isPending,

    voidInvoice: (invoice: Invoice) => voidMutation.mutate(invoice),
    voidingInvoiceId: pendingId(voidMutation),
    isVoiding: voidMutation.isPending,

    deleteInvoice: (invoice: Invoice) => deleteMutation.mutate(invoice),
    deletingInvoiceId: pendingId(deleteMutation),
    isDeleting: deleteMutation.isPending,

    createSeriesInvoice: (seriesId: string) => createSeriesMutation.mutate(seriesId),
    isCreating: createSeriesMutation.isPending,
  };
}
