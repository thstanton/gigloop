import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost, apiPostVoid } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';

export function useInvoiceActions(bookingId: string) {
  const queryClient = useQueryClient();

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

  const issueMutation = useMutation({
    mutationFn: (invoiceId: string) =>
      apiPost(`/bookings/${bookingId}/invoices/${invoiceId}/issue`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingInvoices', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookingChecklist', bookingId] });
      toast({ title: 'Invoice created' });
    },
    onError: () => toast({ title: 'Failed to create invoice', variant: 'destructive' }),
  });

  // Mark as sent without email for ISSUED invoices (dates already set at issue time)
  const markSentMutation = useMutation({
    mutationFn: (invoiceId: string) =>
      apiPost(`/bookings/${bookingId}/invoices/${invoiceId}/mark-sent`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingInvoices', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookingChecklist', bookingId] });
      toast({ title: 'Invoice marked as sent' });
    },
    onError: () => toast({ title: 'Failed to mark invoice as sent', variant: 'destructive' }),
  });

  return {
    voidInvoice: (invoiceId: string) => voidInvoiceMutation.mutate(invoiceId),
    isVoidingInvoice: voidInvoiceMutation.isPending,
    markPaid: (invoiceId: string) => markPaidMutation.mutate(invoiceId),
    isMarkingPaid: markPaidMutation.isPending,
    markSent: (invoiceId: string) => markSentMutation.mutate(invoiceId),
    isMarkingSent: markSentMutation.isPending,
    issue: (invoiceId: string) => issueMutation.mutate(invoiceId),
    isIssuing: issueMutation.isPending,
  };
}
