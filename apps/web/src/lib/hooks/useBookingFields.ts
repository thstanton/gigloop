import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPatch } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import type { BookingStatus } from '@/types/api';

export function useBookingFields(bookingId: string) {
  const queryClient = useQueryClient();

  function invalidateBookingList() {
    queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
  }

  const updateStatusMutation = useMutation({
    mutationFn: (status: BookingStatus) => apiPatch(`/bookings/${bookingId}`, { status }),
    onSuccess: () => {
      invalidateBookingList();
      queryClient.invalidateQueries({ queryKey: ['bookingChecklist', bookingId] });
    },
    onError: () => toast({ title: 'Failed to update status', variant: 'destructive' }),
  });

  const updateNotesMutation = useMutation({
    mutationFn: (notes: string) => apiPatch(`/bookings/${bookingId}`, { notes: notes || null }),
    onSuccess: () => invalidateBookingList(),
  });

  const updateFeeMutation = useMutation({
    mutationFn: (fee: number) => apiPatch(`/bookings/${bookingId}`, { fee }),
    onSuccess: () => invalidateBookingList(),
  });

  return {
    updateStatus: (status: BookingStatus) => updateStatusMutation.mutate(status),
    isStatusPending: updateStatusMutation.isPending,
    updateNotes: (notes: string) => updateNotesMutation.mutate(notes),
    isNotesPending: updateNotesMutation.isPending,
    updateFee: (fee: number) => updateFeeMutation.mutate(fee),
    isFeePending: updateFeeMutation.isPending,
  };
}
