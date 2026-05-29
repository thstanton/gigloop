import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPatch, apiPost, apiDelete } from '@/lib/api';
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
  });

  const depositMutation = useMutation({
    mutationFn: () =>
      apiPatch(`/bookings/${bookingId}`, { depositReceivedAt: new Date().toISOString() }),
    onSuccess: () => invalidateBooking(),
  });

  const autoCreateInvoiceMutation = useMutation({
    mutationFn: ({ isDeposit, amount }: { isDeposit: boolean; amount: number }) =>
      apiPost<Invoice>(`/bookings/${bookingId}/invoices`, {
        isDeposit,
        lineItems: [{ description: isDeposit ? 'Deposit' : 'Balance', amount }],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingInvoices', bookingId] });
      invalidateBooking();
    },
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: (invoiceId: string) =>
      apiDelete(`/bookings/${bookingId}/invoices/${invoiceId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingInvoices', bookingId] });
    },
  });

  return {
    markContractSigned: (contractId: string) => contractMutation.mutate(contractId),
    markDepositReceived: () => depositMutation.mutate(),
    autoCreateInvoice: (args: { isDeposit: boolean; amount: number }) =>
      autoCreateInvoiceMutation.mutate(args),
    deleteInvoice: (invoiceId: string) => deleteInvoiceMutation.mutate(invoiceId),
    isPending:
      contractMutation.isPending ||
      depositMutation.isPending ||
      autoCreateInvoiceMutation.isPending ||
      deleteInvoiceMutation.isPending,
  };
}
