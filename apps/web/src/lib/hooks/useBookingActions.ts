import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPatch, apiPost, apiDelete } from '@/lib/api';
import type { BookingDetail, Invoice } from '@/types/api';

export function useBookingActions(bookingId: string) {
  const queryClient = useQueryClient();

  const contractMutation = useMutation({
    mutationFn: () =>
      apiPatch<BookingDetail>(`/bookings/${bookingId}`, { contractSignedAt: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
    },
  });

  const depositMutation = useMutation({
    mutationFn: () =>
      apiPatch<BookingDetail>(`/bookings/${bookingId}`, { depositReceivedAt: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
    },
  });

  const autoCreateInvoiceMutation = useMutation({
    mutationFn: ({ isDeposit, amount }: { isDeposit: boolean; amount: number }) =>
      apiPost<Invoice>(`/bookings/${bookingId}/invoices`, {
        isDeposit,
        lineItems: [{ description: isDeposit ? 'Deposit' : 'Balance', amount }],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingInvoices', bookingId] });
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
    markContractSigned: () => contractMutation.mutate(),
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
