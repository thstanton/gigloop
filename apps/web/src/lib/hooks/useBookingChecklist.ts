import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch, apiPost } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { STATUS_ORDER } from '@/lib/constants';
import type { BookingDetail, BookingStatus, ChecklistItem } from '@/types/api';

const CELEBRATORY_TITLES = [
  "You're smashing it!",
  "Nice work!",
  "All done!",
  "You're on a roll!",
];

const TRANSITION_STATUSES = ['PROVISIONAL', 'CONFIRMED', 'READY', 'COMPLETE'] as const;

// A dependency stops blocking once it is COMPLETE or SKIPPED (or absent). Mirrors the
// server's isDepSatisfied (checklist-evaluator.service.ts).
function isDepSatisfied(depKey: string, stateByKey: Map<string, ChecklistItem['state']>): boolean {
  const s = stateByKey.get(depKey);
  return s === undefined || s === 'COMPLETE' || s === 'SKIPPED';
}

/**
 * Optimistic, structural dependency propagation: after a toggle flips one item, recompute
 * each non-terminal item's BLOCKED↔PENDING state so dependents unblock instantly without a
 * refetch. We only touch the BLOCKED↔PENDING axis — never COMPLETE/SKIPPED/FAILED (terminal;
 * the server's computeUpdates skips them too) and never auto-complete a ruled item (rule
 * evaluation needs booking context only the server has). The server response then settles any
 * rule-driven COMPLETE in the same round-trip. A single pass suffices: an item going
 * BLOCKED→PENDING does not itself satisfy a dependency, so it cannot cascade further.
 */
export function propagateBlocking(items: ChecklistItem[]): ChecklistItem[] {
  const stateByKey = new Map<string, ChecklistItem['state']>();
  for (const it of items) if (it.key) stateByKey.set(it.key, it.state);
  return items.map((it) => {
    if (it.state === 'COMPLETE' || it.state === 'SKIPPED' || it.state === 'FAILED') return it;
    if (it.dependsOn.length === 0) return it;
    const blocked = it.dependsOn.some((dep) => !isDepSatisfied(dep, stateByKey));
    const next: ChecklistItem['state'] = blocked ? 'BLOCKED' : 'PENDING';
    return next === it.state ? it : { ...it, state: next };
  });
}

function isChecklistCompleteFor(checklist: ChecklistItem[], status: BookingStatus): boolean {
  const items = checklist.filter((i) => i.requiredForStatus === status);
  return items.length > 0 && items.every((i) => i.state === 'COMPLETE');
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
  // Monotonic toggle sequence: only the latest-initiated toggle's response is allowed to write
  // the cache, so a slow earlier response can't clobber a newer rapid toggle of the same item.
  const toggleSeq = useRef(0);

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
    mutationFn: ({ itemId, state }: { itemId: string; state: 'COMPLETE' | 'PENDING' }) =>
      apiPatch<ChecklistItem[]>(`/bookings/${bookingId}/checklist/${itemId}`, { state }),
    onMutate: async ({ itemId, state }) => {
      await queryClient.cancelQueries({ queryKey: ['bookingChecklist', bookingId] });
      const previous = queryClient.getQueryData<ChecklistItem[]>(['bookingChecklist', bookingId]);
      const seq = ++toggleSeq.current;
      queryClient.setQueryData<ChecklistItem[]>(['bookingChecklist', bookingId], (old) => {
        if (!old) return [];
        const toggled = old.map((item) => (item.id === itemId ? { ...item, state } : item));
        // Propagate the unblock/block to dependents so the cascade feels instant.
        return propagateBlocking(toggled);
      });
      return { previous, seq };
    },
    onError: (_err, _vars, context) => {
      // Reverts to this mutation's own pre-state. A concurrent sibling toggle's optimistic
      // update could be lost here, but that only happens on an actual request failure.
      if (context?.previous) queryClient.setQueryData(['bookingChecklist', bookingId], context.previous);
      toast({ title: 'Failed to update checklist item', variant: 'destructive' });
    },
    onSuccess: (data, _vars, context) => {
      if (!Array.isArray(data)) return;
      // Only the latest-initiated toggle writes the recomputed array — a stale earlier response
      // must not clobber a newer rapid toggle of the same item.
      if (context?.seq !== toggleSeq.current) return;
      // Residual gap (#595): two *different* items toggled concurrently and processed server-side
      // out of order can leave the latest response missing the sibling's change. Acceptable here —
      // a fully correct fix needs a server version token; we don't refetch (one round-trip).
      queryClient.setQueryData<ChecklistItem[]>(['bookingChecklist', bookingId], data);
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
    mutationFn: (status: BookingStatus) => apiPatch(`/bookings/${bookingId}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
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
    toggleItem: (itemId: string, state: 'COMPLETE' | 'PENDING') => toggleItemMutation.mutate({ itemId, state }),
    addItem: (data: { label: string; requiredForStatus: string | null; dueDate: string | null }) => addItemMutation.mutate(data),
    isAddingItem: addItemMutation.isPending,
  };
}
