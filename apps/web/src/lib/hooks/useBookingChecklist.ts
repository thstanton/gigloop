import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch, apiPost } from '@/lib/api';
import { STATUS_ORDER } from '@/lib/constants';
import { toast } from '@/lib/hooks/use-toast';
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
    mutationFn: ({ itemId, state }: { itemId: string; state: 'COMPLETE' | 'PENDING' }) =>
      apiPatch(`/bookings/${bookingId}/checklist/${itemId}`, { state }),
    onMutate: async ({ itemId, state }) => {
      await queryClient.cancelQueries({ queryKey: ['bookingChecklist', bookingId] });
      const previous = queryClient.getQueryData<ChecklistItem[]>(['bookingChecklist', bookingId]);
      queryClient.setQueryData<ChecklistItem[]>(['bookingChecklist', bookingId], (old) =>
        old?.map((item) => item.id === itemId ? { ...item, state } : item) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['bookingChecklist', bookingId], context.previous);
      toast({ title: 'Failed to update checklist item', variant: 'destructive' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingChecklist', bookingId] });
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

  function confirmStatusTransition(status: BookingStatus) {
    setReadyDialogStatus(null);
    apiPatch(`/bookings/${bookingId}`, { status }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['bookingChecklist', bookingId] });
    });
  }

  return {
    checklist,
    checklistLoading,
    readyDialogStatus,
    celebratoryTitle: celebratoryTitle.current,
    dismissReadyDialog,
    confirmStatusTransition,
    toggleItem: (itemId: string, state: 'COMPLETE' | 'PENDING') => toggleItemMutation.mutate({ itemId, state }),
    addItem: (data: { label: string; requiredForStatus: string | null; dueDate: string | null }) => addItemMutation.mutate(data),
    isAddingItem: addItemMutation.isPending,
  };
}
