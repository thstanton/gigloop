import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost, apiPostVoid, apiDelete } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import type { Contract } from '@/types/api';

export function useContractActions(bookingId: string) {
  const queryClient = useQueryClient();

  function invalidateBooking() {
    queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
    queryClient.invalidateQueries({ queryKey: ['bookingChecklist', bookingId] });
  }

  const createContractMutation = useMutation({
    mutationFn: () => apiPost<Contract>(`/bookings/${bookingId}/contracts`, {}),
    onSuccess: () => invalidateBooking(),
    onError: () => toast({ title: 'Failed to create contract', variant: 'destructive' }),
  });

  const sendContractMutation = useMutation({
    mutationFn: (contractId: string) =>
      apiPostVoid(`/bookings/${bookingId}/contracts/${contractId}/send`, {}),
    onSuccess: () => invalidateBooking(),
    onError: () => toast({ title: 'Failed to mark contract as sent', variant: 'destructive' }),
  });

  const voidContractMutation = useMutation({
    mutationFn: ({ contractId, confirmSignedVoid }: { contractId: string; confirmSignedVoid: boolean }) =>
      apiPostVoid(`/bookings/${bookingId}/contracts/${contractId}/void`, { confirmSignedVoid }),
    onSuccess: () => invalidateBooking(),
    onError: () => toast({ title: 'Failed to void contract', variant: 'destructive' }),
  });

  const deleteContractMutation = useMutation({
    mutationFn: (contractId: string) =>
      apiDelete(`/bookings/${bookingId}/contracts/${contractId}`),
    onSuccess: () => invalidateBooking(),
    onError: () => toast({ title: 'Failed to delete contract', variant: 'destructive' }),
  });

  return {
    createContract: (onCreated?: (contract: Contract) => void) =>
      createContractMutation.mutate(undefined, { onSuccess: onCreated }),
    isCreatingContract: createContractMutation.isPending,
    sendContract: (contractId: string) => sendContractMutation.mutate(contractId),
    voidContract: (args: { contractId: string; confirmSignedVoid: boolean }) => voidContractMutation.mutate(args),
    deleteContract: (contractId: string) => deleteContractMutation.mutate(contractId),
  };
}
