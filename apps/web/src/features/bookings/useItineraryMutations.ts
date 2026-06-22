import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiPatch, apiPost } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import type { SetValues } from './ItineraryFields';
import type { BookingDetail, PerformanceSet } from '@/types/api';

// PRD #511 Module B — the Itinerary set/package mutations, shared by both live shells that
// drive the Itinerary atom: BookingBuilderPage and ItineraryQuickTweakSheet. Extracted (#548)
// so the optimistic recipe is written once rather than kept byte-identical in two places.
//
// Scope is deliberately the six set/package mutations that were verbatim duplicates. Apply-template,
// the music-form suggestion banner and the time-anchor save stay in their shells — those carry
// shell-specific state (staged templates, pending suggestion, the logistics inverse-merge).
//
// deleteSet / removePackage / moveSet / updatePackage are OPTIMISTIC: the cached booking is edited
// on click so the row reflects the change instantly (the icon-only triggers otherwise hung through a
// full refetch and read as broken). This over-satisfies Tier 2 — its success path is "the item
// disappears"; the rollback-on-error below is the extra safety. addSet/updateSet stay server-first:
// addSet needs the server-assigned id, updateSet already shows inline "Saving…" in the open SetRow.

function nextOrder(sets: PerformanceSet[]): number {
  return Math.max(0, ...sets.map((s) => s.order)) + 1;
}

type Rollback = { prev?: BookingDetail };

export function useItineraryMutations(bookingId: string, sets: PerformanceSet[]) {
  const queryClient = useQueryClient();
  const bookingKey = ['booking', bookingId];

  const invalidateBooking = () => {
    queryClient.invalidateQueries({ queryKey: bookingKey });
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
  };

  // Optimistically edit the cached booking. cancelQueries first is non-negotiable — without it an
  // in-flight ['booking'] refetch can resolve *after* this write and resurrect the removed row.
  async function applyOptimistic(edit: (b: BookingDetail) => BookingDetail): Promise<Rollback> {
    await queryClient.cancelQueries({ queryKey: bookingKey });
    const prev = queryClient.getQueryData<BookingDetail>(bookingKey);
    if (prev) queryClient.setQueryData<BookingDetail>(bookingKey, edit(prev));
    return { prev };
  }

  function rollback(ctx: Rollback | undefined, title: string) {
    if (ctx?.prev) queryClient.setQueryData(bookingKey, ctx.prev);
    toast({ title, variant: 'destructive' });
  }

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
    onMutate: (setId) =>
      applyOptimistic((b) => ({ ...b, sets: b.sets.filter((s) => s.id !== setId) })),
    onError: (_e, _setId, ctx) => rollback(ctx, 'Failed to delete set. Please try again.'),
    onSettled: invalidateBooking,
  });

  const moveSet = useMutation({
    mutationFn: ({ setId, packageId }: { setId: string; packageId: string | null }) =>
      apiPatch(`/bookings/${bookingId}/sets/${setId}`, { packageId }),
    onMutate: ({ setId, packageId }) =>
      applyOptimistic((b) => ({
        ...b,
        sets: b.sets.map((s) => (s.id === setId ? { ...s, packageId } : s)),
      })),
    onError: (_e, _vars, ctx) => rollback(ctx, 'Failed to move set. Please try again.'),
    onSettled: invalidateBooking,
  });

  const updatePackage = useMutation({
    mutationFn: ({ packageId, dto }: { packageId: string; dto: { label?: string; icon?: string } }) =>
      apiPatch(`/bookings/${bookingId}/packages/${packageId}`, dto),
    onMutate: ({ packageId, dto }) =>
      applyOptimistic((b) => ({
        ...b,
        packages: b.packages.map((p) => (p.id === packageId ? { ...p, ...dto } : p)),
      })),
    onError: (_e, _vars, ctx) => rollback(ctx, 'Failed to update package. Please try again.'),
    onSettled: invalidateBooking,
  });

  const removePackage = useMutation({
    mutationFn: (packageId: string) => apiDelete(`/bookings/${bookingId}/packages/${packageId}`),
    // The server deletes the package AND re-parents its sets to ungrouped — mirror both in the same
    // write, or the contained sets keep a dangling packageId until the refetch lands and visibly pop.
    onMutate: (packageId) =>
      applyOptimistic((b) => ({
        ...b,
        packages: b.packages.filter((p) => p.id !== packageId),
        sets: b.sets.map((s) => (s.packageId === packageId ? { ...s, packageId: null } : s)),
      })),
    onError: (_e, _packageId, ctx) => rollback(ctx, 'Failed to remove package. Please try again.'),
    onSettled: invalidateBooking,
  });

  return { addSet, updateSet, deleteSet, moveSet, updatePackage, removePackage };
}
