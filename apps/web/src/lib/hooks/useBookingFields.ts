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

  const updateVenueMutation = useMutation({
    mutationFn: (venueId: string | null) => apiPatch(`/bookings/${bookingId}`, { venueId }),
    onSuccess: () => invalidateBookingList(),
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
