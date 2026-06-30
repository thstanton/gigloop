import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPatch } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { updateBookingInListCaches } from '@/lib/hooks/useBookings';
import type { BookingDetail, BookingStatus, UpdateBookingSeriesResponse } from '@/types/api';

export function useBookingFields(bookingId: string) {
  const queryClient = useQueryClient();

  // The PATCH endpoints return the updated booking, so settle both caches off the response:
  // invalidate the (cheap) single-booking detail query, and splice the lean row into every
  // cached bookings-list permutation rather than invalidating the whole heavy list (#590).
  function settleBooking(booking: BookingDetail) {
    queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
    updateBookingInListCaches(queryClient, booking);
  }

  const updateStatusMutation = useMutation({
    mutationFn: (status: BookingStatus) => apiPatch<BookingDetail>(`/bookings/${bookingId}`, { status }),
    onSuccess: (booking) => {
      settleBooking(booking);
      queryClient.invalidateQueries({ queryKey: ['bookingChecklist', bookingId] });
      // A status transition shifts the stage gate, so past-stage reminders must drop out of
      // every concern's "Remind me about" control (Overview is the status-driven deal spine).
      queryClient.invalidateQueries({ queryKey: ['bookingReminders', bookingId] });
    },
    onError: () => toast({ title: 'Failed to update status', variant: 'destructive' }),
  });

  const updateNotesMutation = useMutation({
    mutationFn: (notes: string) => apiPatch<BookingDetail>(`/bookings/${bookingId}`, { notes: notes || null }),
    onSuccess: (booking) => settleBooking(booking),
    onError: () => toast({ title: 'Failed to save notes. Please try again.', variant: 'destructive' }),
  });

  const updateFeeMutation = useMutation({
    mutationFn: (fee: number) => apiPatch<BookingDetail>(`/bookings/${bookingId}`, { fee }),
    onSuccess: (booking) => settleBooking(booking),
    onError: () => toast({ title: 'Failed to save fee. Please try again.', variant: 'destructive' }),
  });

  const updateVenueMutation = useMutation({
    mutationFn: (venueId: string | null) => apiPatch<BookingDetail>(`/bookings/${bookingId}`, { venueId }),
    onSuccess: (booking) => settleBooking(booking),
    onError: () => toast({ title: 'Failed to update venue. Please try again.', variant: 'destructive' }),
  });

  const updateSeriesMutation = useMutation({
    mutationFn: (payload: { seriesId: string | null; confirm?: boolean }) =>
      apiPatch<UpdateBookingSeriesResponse | BookingDetail>(`/bookings/${bookingId}/series`, payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      // A confirmation-required response carries no booking to splice; only settle the list when
      // the assignment actually changed (the full booking is returned, identified by `id`).
      if ('id' in result) updateBookingInListCaches(queryClient, result);
    },
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
