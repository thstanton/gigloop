import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPatch, apiPost, apiDelete } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import type { Invoice } from '@/types/api';

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

  const autoCreateInvoiceMutation = useMutation({
    mutationFn: ({ isDeposit, amount }: { isDeposit: boolean; amount: number }) =>
      apiPost<Invoice>(`/bookings/${bookingId}/invoices`, {
        isDeposit,
        lineItems: [{ description: isDeposit ? 'Deposit' : 'Balance', amount }],
      }),
    onSuccess: (invoice) => {
      // Seed the new draft into the list so a caller opening the sheet on it resolves the
      // editingInvoice immediately — no create→edit flicker while the refetch is in flight.
      queryClient.setQueryData<Invoice[]>(['bookingInvoices', bookingId], (old) =>
        old ? [...old, invoice] : old,
      );
      queryClient.invalidateQueries({ queryKey: ['bookingInvoices', bookingId] });
      invalidateBooking();
    },
    onError: () => {
      toast({ title: 'Failed to create invoice — please try again', variant: 'destructive' });
    },
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
    autoCreateInvoice: (
      args: { isDeposit: boolean; amount: number },
      onCreated?: (invoice: Invoice) => void,
    ) => autoCreateInvoiceMutation.mutate(args, { onSuccess: onCreated }),
    deleteInvoice: (invoiceId: string) => deleteInvoiceMutation.mutate(invoiceId),
    isDeletingInvoice: deleteInvoiceMutation.isPending,
    isPending:
      contractMutation.isPending ||
      depositMutation.isPending ||
      autoCreateInvoiceMutation.isPending ||
      deleteInvoiceMutation.isPending,
  };
}
