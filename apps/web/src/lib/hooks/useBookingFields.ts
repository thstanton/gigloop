import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPatch } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import type { BookingDetail, BookingStatus, UpdateBookingSeriesResponse } from '@/types/api';

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
      // A status transition shifts the stage gate, so past-stage reminders must drop out of
      // every concern's "Remind me about" control (Overview is the status-driven deal spine).
      queryClient.invalidateQueries({ queryKey: ['bookingReminders', bookingId] });
    },
    onError: () => toast({ title: 'Failed to update status', variant: 'destructive' }),
  });

  const updateNotesMutation = useMutation({
    mutationFn: (notes: string) => apiPatch(`/bookings/${bookingId}`, { notes: notes || null }),
    onSuccess: () => invalidateBookingList(),
    onError: () => toast({ title: 'Failed to save notes. Please try again.', variant: 'destructive' }),
  });

  const updateFeeMutation = useMutation({
    mutationFn: (fee: number) => apiPatch(`/bookings/${bookingId}`, { fee }),
    onSuccess: () => invalidateBookingList(),
    onError: () => toast({ title: 'Failed to save fee. Please try again.', variant: 'destructive' }),
  });

  const updateVenueMutation = useMutation({
    mutationFn: (venueId: string | null) => apiPatch(`/bookings/${bookingId}`, { venueId }),
    onSuccess: () => invalidateBookingList(),
    onError: () => toast({ title: 'Failed to update venue. Please try again.', variant: 'destructive' }),
  });

  const updateSeriesMutation = useMutation({
    mutationFn: (payload: { seriesId: string | null; confirm?: boolean }) =>
      apiPatch<UpdateBookingSeriesResponse | BookingDetail>(`/bookings/${bookingId}/series`, payload),
    onSuccess: () => invalidateBookingList(),
    onError: () => toast({ title: 'Failed to update series assignment', variant: 'destructive' }),
  });

  return {
    updateStatus: (status: BookingStatus) => updateStatusMutation.mutate(status),
    isStatusPending: updateStatusMutation.isPending,
    updateNotes: (notes: string) => updateNotesMutation.mutate(notes),
    isNotesPending: updateNotesMutation.isPending,
    updateFee: (fee: number) => updateFeeMutation.mutate(fee),
    isFeePending: updateFeeMutation.isPending,
    updateVenue: (venueId: string | null) => updateVenueMutation.mutate(venueId),
    isVenuePending: updateVenueMutation.isPending,
    updateSeries: (
      payload: { seriesId: string | null; confirm?: boolean },
      callbacks?: { onSuccess?: (result: UpdateBookingSeriesResponse | BookingDetail) => void },
    ) => updateSeriesMutation.mutate(payload, callbacks),
    isSeriesPending: updateSeriesMutation.isPending,
  };
}
