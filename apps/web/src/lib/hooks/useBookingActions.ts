import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPatch } from '@/lib/api';
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

  return {
    markContractSigned: (contractId: string) => contractMutation.mutate(contractId),
    markDepositReceived: () => depositMutation.mutate(),
    isPending: contractMutation.isPending || depositMutation.isPending,
  };
}
