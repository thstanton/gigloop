import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch, apiPost } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { STATUS_ORDER } from '@/lib/constants';
import { updateBookingInListCaches } from '@/lib/hooks/useBookings';
import type { BookingDetail, BookingStatus, ChecklistItem } from '@/types/api';

const CELEBRATORY_TITLES = [
  "You're smashing it!",
  "Nice work!",
  "All done!",
  "You're on a roll!",
];

const TRANSITION_STATUSES = ['PROVISIONAL', 'CONFIRMED', 'READY', 'COMPLETE'] as const;

function isChecklistCompleteFor(checklist: ChecklistItem[], status: BookingStatus): boolean {
  const items = checklist.filter((i) => i.requiredForStatus === status);
  return items.length > 0 && items.every((i) => i.state === 'COMPLETE');
}

// ADR-0076 — settle a toggle response by the server's own version, per goal. A goal's
// `updatedAt` versions the goal AND its steps (the API touches a parent row whenever one of
// its steps is written), so it is the one authority on which copy of a goal is newer.
//
// Membership comes from `incoming` — it is the server's current truth about WHICH goals exist.
// For each goal the newer copy wins, and a TIE KEEPS THE CACHED COPY. That tie is not an edge
// case: the optimistic tick in `onMutate` is a client-side change and does not bump `updatedAt`,
// so an in-flight goal sits at its old timestamp carrying its new state. Letting the incoming
// copy win a tie would revert the tap the musician just made — which is #595 itself.
//
// String comparison is the right one: `updatedAt` is an ISO-8601 UTC timestamp from
// `toISOString()`, fixed-width and always `Z`, so lexicographic order is chronological order.
function mergeByVersion(
  cached: ChecklistItem[] | undefined,
  incoming: ChecklistItem[],
): ChecklistItem[] {
  if (!cached?.length) return incoming;
  const byId = new Map(cached.map((item) => [item.id, item]));
  return incoming.map((item) => {
    const mine = byId.get(item.id);
    return mine && mine.updatedAt >= item.updatedAt ? mine : item;
  });
}

function findReadyStatus(
  booking: BookingDetail,
  checklist: ChecklistItem[],
  bookingId: string,
  dismissed: Set<string>,
): BookingStatus | undefined {
  const currentIdx = STATUS_ORDER.indexOf(booking.status);
  return TRANSITION_STATUSES.find((s) => {
    if (STATUS_ORDER.indexOf(s) <= currentIdx) return false;
    if (dismissed.has(`${bookingId}:${booking.status}->${s}`)) return false;
    return isChecklistCompleteFor(checklist, s);
  });
}

export function useBookingChecklist(
  bookingId: string,
  booking: BookingDetail | undefined,
  isLoaded: boolean,
) {
  const queryClient = useQueryClient();
  const [readyDialogStatus, setReadyDialogStatus] = useState<BookingStatus | null>(null);
  const dismissedTransitions = useRef(new Set<string>());
  const titleIndex = useRef(0);
  const celebratoryTitle = useRef(CELEBRATORY_TITLES[0]);

  const { data: checklist = [], isPending: checklistLoading } = useQuery({
    queryKey: ['bookingChecklist', bookingId],
    queryFn: () => apiGet<ChecklistItem[]>(`/bookings/${bookingId}/checklist`),
    enabled: isLoaded && !!booking && booking.status !== 'CANCELLED',
  });

  useEffect(() => {
    if (!booking || checklistLoading || checklist.length === 0) return;
    const target = findReadyStatus(booking, checklist, bookingId, dismissedTransitions.current);
    if (target) setReadyDialogStatus(target);
  }, [booking, checklist, checklistLoading, bookingId]);

  const toggleItemMutation = useMutation({
    // SKIPPED is the musician's reversible opt-out (ADR-0057) — set on a goal via the row kebab,
    // cleared by setting PENDING. Optimistic flip + server-settled roll-up, same path as a tick.
    mutationFn: ({ itemId, state }: { itemId: string; state: 'COMPLETE' | 'PENDING' | 'SKIPPED' }) =>
      apiPatch<ChecklistItem[]>(`/bookings/${bookingId}/checklist/${itemId}`, { state }),
    onMutate: async ({ itemId, state }) => {
      await queryClient.cancelQueries({ queryKey: ['bookingChecklist', bookingId] });
      const previous = queryClient.getQueryData<ChecklistItem[]>(['bookingChecklist', bookingId]);
      queryClient.setQueryData<ChecklistItem[]>(['bookingChecklist', bookingId], (old) => {
        if (!old) return [];
        // ADR-0057 / #609: BLOCKED retired — no dependency propagation. The toggled item flips
        // optimistically; the server response settles any rule-driven roll-up in the same round-trip.
        return old.map((item) => (item.id === itemId ? { ...item, state } : item));
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Reverts to this mutation's own pre-state. A concurrent sibling toggle's optimistic
      // update could be lost here, but that only happens on an actual request failure.
      if (context?.previous) queryClient.setQueryData(['bookingChecklist', bookingId], context.previous);
      toast({ title: 'Failed to update checklist item', variant: 'destructive' });
    },
    onSuccess: (data) => {
      if (!Array.isArray(data)) return;
      // #595 / ADR-0076: merge per goal by server version rather than replacing the array
      // wholesale. The write→re-evaluate→re-read in `updateChecklistItem` is not one
      // transaction, so a concurrent toggle's response can carry a stale copy of a sibling
      // goal; taking only the goals it is genuinely newer for lets every response contribute
      // what it actually knows. This replaces the old client-side toggle-sequence guard, which
      // ordered by *client initiation* — the wrong authority, and which discarded the very
      // response that carried the correction. We still never refetch (one round-trip, #587).
      queryClient.setQueryData<ChecklistItem[]>(['bookingChecklist', bookingId], (cached) =>
        mergeByVersion(cached, data),
      );
    },
  });

  const addItemMutation = useMutation({
    mutationFn: (data: { label: string; requiredForStatus: string | null; dueDate: string | null }) =>
      apiPost(`/bookings/${bookingId}/checklist`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingChecklist', bookingId] });
    },
    onError: () => toast({ title: 'Failed to add item', variant: 'destructive' }),
  });

  function advanceTitle() {
    titleIndex.current = (titleIndex.current + 1) % CELEBRATORY_TITLES.length;
    celebratoryTitle.current = CELEBRATORY_TITLES[titleIndex.current];
  }

  function dismissReadyDialog() {
    if (!booking || !readyDialogStatus) return;
    dismissedTransitions.current.add(`${bookingId}:${booking.status}->${readyDialogStatus}`);
    advanceTitle();
    setReadyDialogStatus(null);
  }

  const statusTransitionMutation = useMutation({
    mutationFn: (status: BookingStatus) => apiPatch<BookingDetail>(`/bookings/${bookingId}`, { status }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      // Splice the lean row into the cached lists instead of invalidating the whole heavy list
      // (#590); a status change's bucket move self-corrects on the list's next staleTime-0 refetch.
      updateBookingInListCaches(queryClient, updated);
      queryClient.invalidateQueries({ queryKey: ['bookingChecklist', bookingId] });
      setReadyDialogStatus(null);
    },
    onError: () => toast({ title: 'Failed to update booking status', variant: 'destructive' }),
  });

  function confirmStatusTransition(status: BookingStatus) {
    statusTransitionMutation.mutate(status);
  }

  return {
    checklist,
    checklistLoading,
    readyDialogStatus,
    celebratoryTitle: celebratoryTitle.current,
    dismissReadyDialog,
    confirmStatusTransition,
    isConfirmingTransition: statusTransitionMutation.isPending,
    toggleItem: (itemId: string, state: 'COMPLETE' | 'PENDING' | 'SKIPPED') => toggleItemMutation.mutate({ itemId, state }),
    addItem: (data: { label: string; requiredForStatus: string | null; dueDate: string | null }) => addItemMutation.mutate(data),
    isAddingItem: addItemMutation.isPending,
  };
}
