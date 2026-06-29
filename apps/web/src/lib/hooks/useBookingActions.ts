import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPatch, apiDelete } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';

export function useBookingActions(bookingId: string) {
  const queryClient = useQueryClient();

  function invalidateBooking() {
    queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
    queryClient.invalidateQueries({ queryKey: ['bookingChecklist', bookingId] });
  }

  const contractMutation = useMutation({
    mutationFn: (contractId: string) =>
      apiPatch(`/bookings/${bookingId}/contracts/${contractId}`, {
        status: 'SIGNED',
        signedAt: new Date().toISOString(),
      }),
    onSuccess: () => invalidateBooking(),
    onError: () => toast({ title: 'Failed to mark contract as signed', variant: 'destructive' }),
  });

  const depositMutation = useMutation({
    mutationFn: () =>
      apiPatch(`/bookings/${bookingId}`, { depositReceivedAt: new Date().toISOString() }),
    onSuccess: () => invalidateBooking(),
    onError: () => toast({ title: 'Failed to mark deposit as received', variant: 'destructive' }),
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: (invoiceId: string) =>
      apiDelete(`/bookings/${bookingId}/invoices/${invoiceId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingInvoices', bookingId] });
    },
    onError: () => toast({ title: 'Failed to delete invoice', variant: 'destructive' }),
  });

  return {
    markContractSigned: (contractId: string) => contractMutation.mutate(contractId),
    markDepositReceived: () => depositMutation.mutate(),
    deleteInvoice: (invoiceId: string) => deleteInvoiceMutation.mutate(invoiceId),
    isDeletingInvoice: deleteInvoiceMutation.isPending,
    isPending:
      contractMutation.isPending ||
      depositMutation.isPending ||
      deleteInvoiceMutation.isPending,
  };
}
