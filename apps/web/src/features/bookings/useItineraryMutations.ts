import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiPatch, apiPost } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import type { SetValues } from './ItineraryFields';
import type { PerformanceSet } from '@/types/api';

// PRD #511 Module B — the Itinerary set/package mutations, shared by both live shells that
// drive the Itinerary atom: BookingBuilderPage and ItineraryQuickTweakSheet. Extracted (#548)
// so the (now optimistic) recipe is written once rather than kept byte-identical in two places.
//
// Scope is deliberately the six set/package mutations that were verbatim duplicates. Apply-template,
// the music-form suggestion banner and the time-anchor save stay in their shells — those carry
// shell-specific state (staged templates, pending suggestion, the logistics inverse-merge).

function nextOrder(sets: PerformanceSet[]): number {
  return Math.max(0, ...sets.map((s) => s.order)) + 1;
}

export function useItineraryMutations(bookingId: string, sets: PerformanceSet[]) {
  const queryClient = useQueryClient();

  const invalidateBooking = () => {
    queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
  };

  const addSet = useMutation({
    mutationFn: ({ packageId, values }: { packageId: string | null; values: SetValues }) =>
      apiPost(`/bookings/${bookingId}/sets`, {
        order: nextOrder(sets),
        duration: values.duration,
        ...(values.startTime ? { startTime: values.startTime } : {}),
        ...(values.label ? { label: values.label } : {}),
        ...(packageId ? { packageId } : {}),
      }),
    onSuccess: invalidateBooking,
    onError: () => toast({ title: 'Failed to add set. Please try again.', variant: 'destructive' }),
  });

  const updateSet = useMutation({
    mutationFn: ({ setId, values }: { setId: string; values: SetValues }) =>
      apiPatch(`/bookings/${bookingId}/sets/${setId}`, values),
    onSuccess: invalidateBooking,
    onError: () => toast({ title: 'Failed to save set. Please try again.', variant: 'destructive' }),
  });

  const deleteSet = useMutation({
    mutationFn: (setId: string) => apiDelete(`/bookings/${bookingId}/sets/${setId}`),
    onSuccess: invalidateBooking,
    onError: () => toast({ title: 'Failed to delete set. Please try again.', variant: 'destructive' }),
  });

  const moveSet = useMutation({
    mutationFn: ({ setId, packageId }: { setId: string; packageId: string | null }) =>
      apiPatch(`/bookings/${bookingId}/sets/${setId}`, { packageId }),
    onSuccess: invalidateBooking,
    onError: () => toast({ title: 'Failed to move set. Please try again.', variant: 'destructive' }),
  });

  const updatePackage = useMutation({
    mutationFn: ({ packageId, dto }: { packageId: string; dto: { label?: string; icon?: string } }) =>
      apiPatch(`/bookings/${bookingId}/packages/${packageId}`, dto),
    onSuccess: invalidateBooking,
    onError: () => toast({ title: 'Failed to update package. Please try again.', variant: 'destructive' }),
  });

  const removePackage = useMutation({
    mutationFn: (packageId: string) => apiDelete(`/bookings/${bookingId}/packages/${packageId}`),
    onSuccess: invalidateBooking,
    onError: () => toast({ title: 'Failed to remove package. Please try again.', variant: 'destructive' }),
  });

  return { addSet, updateSet, deleteSet, moveSet, updatePackage, removePackage };
}
