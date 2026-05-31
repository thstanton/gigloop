import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost, apiPostVoid } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import type { Invoice } from '@/types/api';

export function useInvoiceActions(bookingId: string) {
  const queryClient = useQueryClient();
  const [invoiceSheetState, setInvoiceSheetState] = useState<{
    invoice?: Invoice;
    prefill?: { isDeposit: boolean; amount?: number; description?: string };
  } | null>(null);
  const [markSentInvoice, setMarkSentInvoice] = useState<Invoice | undefined>();

  const voidInvoiceMutation = useMutation({
    mutationFn: (invoiceId: string) =>
      apiPostVoid(`/bookings/${bookingId}/invoices/${invoiceId}/void`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingInvoices', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookingChecklist', bookingId] });
    },
    onError: () => toast({ title: 'Failed to void invoice', variant: 'destructive' }),
  });

  const markPaidMutation = useMutation({
    mutationFn: (invoiceId: string) =>
      apiPost(`/bookings/${bookingId}/invoices/${invoiceId}/mark-paid`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingInvoices', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookingChecklist', bookingId] });
    },
    onError: () => toast({ title: 'Failed to mark invoice as paid', variant: 'destructive' }),
  });

  return {
    invoiceSheetState,
    setInvoiceSheetState,
    markSentInvoice,
    setMarkSentInvoice,
    voidInvoice: (invoiceId: string) => voidInvoiceMutation.mutate(invoiceId),
    markPaid: (invoiceId: string) => markPaidMutation.mutate(invoiceId),
    isMarkingPaid: markPaidMutation.isPending,
  };
}
