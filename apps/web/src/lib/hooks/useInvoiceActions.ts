import { useState } from 'react';
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { apiPost, apiPatch, apiPostVoid, apiDelete } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { invoiceOwnerRoute, type InvoiceAction } from '@/lib/invoiceActionRouting';
import { invoiceLabel } from '@/lib/invoiceDerivations';
import type { CreateSeriesInvoiceResponse, Invoice } from '@/types/api';

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
  // `edit` is dispatched by InvoiceSheet, not this hook — but the map stays exhaustive over the
  // vocabulary so a newly added action can't be half-declared, and the copy matches the sheet's.
  edit: 'Failed to update invoice',
  issue: 'Failed to create invoice',
  // Like `edit`, dispatched elsewhere — the compose sheet owns the send and shows its failure
  // inline rather than as a toast. Declared so the map stays exhaustive over the vocabulary.
  send: 'Failed to send invoice',
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
  const voidMutation = useMutation(config('void', 'void', (url) => apiPostVoid(url, {})));

  // Mark-paid is no longer a one-tap action: it records the date the payment was *received* plus an
  // optional reference (ADR-0068), captured in MarkPaidDialog. The *same* dialog corrects an
  // already-recorded payment (TIM-46), prefilled from the stored values — so one target, tagged
  // with its mode, drives both. 'record' POSTs mark-paid (SENT → PAID); 'correct' PATCHes the
  // payment on an already-PAID invoice without touching its status. Neither can use the empty-body
  // `config()` helper since their variables carry the payload.
  const [paymentTarget, setPaymentTarget] = useState<{ invoice: Invoice; mode: 'record' | 'correct' } | null>(null);
  type PaymentVars = { invoice: Invoice; paidAt: string; paymentReference?: string };
  const markPaidMutation = useMutation({
    mutationFn: ({ invoice, paidAt, paymentReference }: PaymentVars) =>
      apiPost(`${invoiceOwnerRoute(invoice, 'markPaid').prefix}/${invoice.id}/mark-paid`, { paidAt, paymentReference }),
    onSuccess: (_data, { invoice }) => onSuccess(invoice, 'markPaid'),
    onError: () => toast({ title: ERROR_TOAST.markPaid, variant: 'destructive' }),
  });
  const correctPaymentMutation = useMutation({
    mutationFn: ({ invoice, paidAt, paymentReference }: PaymentVars) =>
      apiPatch(`${invoiceOwnerRoute(invoice, 'markPaid').prefix}/${invoice.id}/payment`, { paidAt, paymentReference }),
    onSuccess: (_data, { invoice }) => onSuccess(invoice, 'markPaid'),
    onError: () => toast({ title: 'Failed to update payment', variant: 'destructive' }),
  });
  const deleteMutation = useMutation({
    mutationFn: (invoice: Invoice) => apiDelete(`${invoiceOwnerRoute(invoice, 'delete').prefix}/${invoice.id}`),
    onSuccess: (_data, invoice) => onSuccess(invoice, 'delete'),
    onError: () => toast({ title: ERROR_TOAST.delete, variant: 'destructive' }),
  });

  // Series-only: no invoice exists yet, so this derives from the seriesId directly.
  const createSeriesMutation = useMutation({
    mutationFn: (seriesId: string) => apiPost<CreateSeriesInvoiceResponse>(`/series/${seriesId}/invoices`, {}),
    onSuccess: (data, seriesId) => {
      queryClient.invalidateQueries({ queryKey: ['seriesInvoice', seriesId] });
      // A fee-less member still bills a £0.00 line unconditionally (#850) — this is a heads-up,
      // not a block, so it never reaches a client unnoticed.
      if (data.feelessMemberCount > 0) {
        const isSingle = data.feelessMemberCount === 1;
        toast({
          title: `${data.feelessMemberCount} member${isSingle ? '' : 's'} billed with no fee set`,
          description: `The line${isSingle ? '' : 's'} ${isSingle ? 'shows' : 'show'} £0.00 — set a fee or edit the line before sending.`,
        });
      }
    },
    onError: () => toast({ title: 'Failed to create series invoice', variant: 'destructive' }),
  });

  return {
    issue: (invoice: Invoice) => issueMutation.mutate(invoice),
    issuingInvoiceId: pendingId(issueMutation),
    isIssuing: issueMutation.isPending,

    markSent: (invoice: Invoice) => markSentMutation.mutate(invoice),
    markingSentId: pendingId(markSentMutation),
    isMarkingSent: markSentMutation.isPending,

    // Open the dialog to record a fresh payment (SENT invoice); confirming POSTs mark-paid.
    requestMarkPaid: (invoice: Invoice) => setPaymentTarget({ invoice, mode: 'record' }),
    // Open the same dialog to correct an already-recorded payment (PAID invoice); confirming PATCHes.
    requestCorrectPayment: (invoice: Invoice) => setPaymentTarget({ invoice, mode: 'correct' }),
    markingPaidId: markPaidMutation.isPending ? (markPaidMutation.variables?.invoice.id ?? null) : null,
    isMarkingPaid: markPaidMutation.isPending,
    // Props for the single MarkPaidDialog a container renders; structurally matches MarkPaidDialogProps.
    // The active mutation and the prefill both follow the target's mode.
    markPaidDialog: {
      open: paymentTarget !== null,
      onOpenChange: (open: boolean) => { if (!open) setPaymentTarget(null); },
      onConfirm: (paidAt: string, paymentReference: string) => {
        if (!paymentTarget) return;
        const mutation = paymentTarget.mode === 'correct' ? correctPaymentMutation : markPaidMutation;
        mutation.mutate(
          { invoice: paymentTarget.invoice, paidAt, paymentReference: paymentReference || undefined },
          { onSuccess: () => setPaymentTarget(null) },
        );
      },
      isPending: (paymentTarget?.mode === 'correct' ? correctPaymentMutation : markPaidMutation).isPending,
      invoiceLabel: paymentTarget ? invoiceLabel(paymentTarget.invoice) : undefined,
      // When correcting, prefill from the stored values (paidAt is an ISO string → date portion);
      // when recording, leave undefined so the dialog defaults to today + a blank reference.
      initialPaidAt: paymentTarget?.mode === 'correct' ? (paymentTarget.invoice.paidAt?.slice(0, 10) ?? undefined) : undefined,
      initialReference: paymentTarget?.mode === 'correct' ? (paymentTarget.invoice.paymentReference ?? undefined) : undefined,
    },

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
