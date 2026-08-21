import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiPatch, apiPost } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import type { BookingBandChair, BookingBandMemberStatus, BookingDetail } from '@/types/api';

// Band members v1 (#879, ADR-0072 §2/§3/§5, #884/#885). Mirrors useItineraryMutations: the shell
// that drives the Band atom (BandSheet) owns these mutations; the atom stays presentational.
// Chair CRUD + lineups are #884; assignChair/updateMemberStatus/saveMemberFee/removeMember are #885.

function nextOrder(chairs: BookingBandChair[]): number {
  return Math.max(0, ...chairs.map((c) => c.order)) + 1;
}

type Rollback = { prev?: BookingDetail };

export function useBandMutations(bookingId: string, chairs: BookingBandChair[]) {
  const queryClient = useQueryClient();
  const bookingKey = ['booking', bookingId];

  const invalidateBooking = () => {
    queryClient.invalidateQueries({ queryKey: bookingKey });
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
  };

  // Mirrors useItineraryMutations.applyOptimistic — cancelQueries first is non-negotiable, else
  // an in-flight ['booking'] refetch can resolve after this write and resurrect a removed chair.
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

  const applyLineup = useMutation({
    mutationFn: ({ lineupTemplateId, packageId }: { lineupTemplateId: string; packageId: string | null }) =>
      apiPost(`/bookings/${bookingId}/lineups`, { lineupTemplateId, ...(packageId ? { packageId } : {}) }),
    onSuccess: invalidateBooking,
    onError: () => toast({ title: 'Failed to apply lineup. Please try again.', variant: 'destructive' }),
  });

  const addChair = useMutation({
    mutationFn: ({ role, packageId }: { role: string; packageId: string | null }) =>
      apiPost(`/bookings/${bookingId}/chairs`, {
        role,
        order: nextOrder(chairs),
        ...(packageId ? { packageId } : {}),
      }),
    onSuccess: invalidateBooking,
    onError: () => toast({ title: 'Failed to add chair. Please try again.', variant: 'destructive' }),
  });

  // Optimistic (unlike addSet/updateSet's server-first pattern): moveChair below fires two of
  // these back-to-back to swap an order pair, and a round-trip-per-write would let the first
  // PATCH's success refetch a half-swapped server state before the second lands, flickering the
  // row order. Each onMutate reads the cache as the previous mutate() call left it, so the pair
  // composes into one correct optimistic swap rather than two racing round-trips.
  const updateChair = useMutation({
    mutationFn: ({ chairId, dto }: { chairId: string; dto: { role?: string; order?: number } }) =>
      apiPatch(`/bookings/${bookingId}/chairs/${chairId}`, dto),
    onMutate: ({ chairId, dto }) =>
      applyOptimistic((b) => ({
        ...b,
        band: { ...b.band, chairs: b.band.chairs.map((c) => (c.id === chairId ? { ...c, ...dto } : c)) },
      })),
    onError: (_e, _vars, ctx) => rollback(ctx, 'Failed to update chair. Please try again.'),
    onSettled: invalidateBooking,
  });

  const removeChair = useMutation({
    mutationFn: (chairId: string) => apiDelete(`/bookings/${bookingId}/chairs/${chairId}`),
    onMutate: (chairId) =>
      applyOptimistic((b) => ({
        ...b,
        band: { ...b.band, chairs: b.band.chairs.filter((c) => c.id !== chairId) },
      })),
    onError: (_e, _chairId, ctx) => rollback(ctx, 'Failed to remove chair. Please try again.'),
    onSettled: invalidateBooking,
  });

  // Reorders by swapping the `order` of two adjacent chairs (sorted by current order): one
  // synchronous optimistic write up front for the whole swap, then two independent PATCHes.
  // Without the synchronous pre-swap, each PATCH's own optimistic `onMutate` (which awaits
  // cancelQueries) could interleave and momentarily show a half-swapped order; writing the final
  // state here first means both PATCHes' own optimistic edits just redundantly confirm it.
  function moveChair(chairId: string, direction: 'up' | 'down') {
    const sorted = [...chairs].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((c) => c.id === chairId);
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (index === -1 || swapIndex < 0 || swapIndex >= sorted.length) return;
    const a = sorted[index];
    const b = sorted[swapIndex];

    const prev = queryClient.getQueryData<BookingDetail>(bookingKey);
    if (prev) {
      queryClient.setQueryData<BookingDetail>(bookingKey, {
        ...prev,
        band: {
          ...prev.band,
          chairs: prev.band.chairs.map((c) => {
            if (c.id === a.id) return { ...c, order: b.order };
            if (c.id === b.id) return { ...c, order: a.order };
            return c;
          }),
        },
      });
    }

    updateChair.mutate({ chairId: a.id, dto: { order: b.order } });
    updateChair.mutate({ chairId: b.id, dto: { order: a.order } });
  }

  // Assignment never creates or destroys a chair row, it sets a field (ADR-0072 §2) — server-first
  // like addChair/updateChair's re-parent, since the resulting member row (id, contact) isn't known
  // client-side until the response comes back. `contactId: null` vacates.
  const assignChair = useMutation({
    mutationFn: ({ chairId, contactId }: { chairId: string; contactId: string | null }) =>
      apiPatch(`/bookings/${bookingId}/chairs/${chairId}/assign`, { contactId }),
    onSuccess: invalidateBooking,
    onError: () => toast({ title: 'Failed to assign chair. Please try again.', variant: 'destructive' }),
  });

  // Every transition is organiser-driven from the Band sheet (ADR-0072 §5).
  const updateMemberStatus = useMutation({
    mutationFn: ({ memberId, status }: { memberId: string; status: BookingBandMemberStatus }) =>
      apiPatch(`/bookings/${bookingId}/band-members/${memberId}`, { status }),
    onSuccess: invalidateBooking,
    onError: () => toast({ title: 'Failed to update status. Please try again.', variant: 'destructive' }),
  });

  const saveMemberFee = useMutation({
    mutationFn: ({ memberId, sessionFee }: { memberId: string; sessionFee: number | null }) =>
      apiPatch(`/bookings/${bookingId}/band-members/${memberId}`, { sessionFee }),
    onSuccess: invalidateBooking,
    onError: () => toast({ title: 'Failed to save fee. Please try again.', variant: 'destructive' }),
  });

  // Soft removal (ADR-0072 §5): the result is fully known client-side (the member disappears, and
  // every chair it held reverts to a vacancy), so — unlike assignChair — this is optimistic,
  // mirroring removeChair above.
  const removeMember = useMutation({
    mutationFn: (memberId: string) => apiDelete(`/bookings/${bookingId}/band-members/${memberId}`),
    onMutate: (memberId) =>
      applyOptimistic((b) => ({
        ...b,
        band: {
          ...b.band,
          members: b.band.members.filter((m) => m.id !== memberId),
          chairs: b.band.chairs.map((c) => (c.memberId === memberId ? { ...c, memberId: null } : c)),
        },
      })),
    onError: (_e, _memberId, ctx) => rollback(ctx, 'Failed to remove member. Please try again.'),
    onSettled: invalidateBooking,
  });

  return {
    applyLineup,
    addChair,
    updateChair,
    removeChair,
    moveChair,
    assignChair,
    updateMemberStatus,
    saveMemberFee,
    removeMember,
  };
}
