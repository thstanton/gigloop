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

export function useBookingChecklist(
  bookingId: string,
  booking: BookingDetail | undefined,
  isLoaded: boolean,
) {
  const queryClient = useQueryClient();
  const [readyDialogStatus, setReadyDialogStatus] = useState<BookingStatus | null>(null);
  const dismissedTransitions = useRef(new Set<string>());
  const celebratoryTitle = useRef(CELEBRATORY_TITLES[Math.floor(Math.random() * CELEBRATORY_TITLES.length)]);

  const { data: checklist = [], isPending: checklistLoading } = useQuery({
    queryKey: ['bookingChecklist', bookingId],
    queryFn: () => apiGet<ChecklistItem[]>(`/bookings/${bookingId}/checklist`),
    enabled: isLoaded && !!booking && booking.status !== 'CANCELLED',
  });

  useEffect(() => {
    if (!booking || checklistLoading || checklist.length === 0) return;
    const targetStatus = (['PROVISIONAL', 'CONFIRMED', 'READY', 'COMPLETE'] as const).find((s) => {
      const targetIdx = STATUS_ORDER.indexOf(s);
      const currentIdx = STATUS_ORDER.indexOf(booking.status);
      if (targetIdx <= currentIdx) return false;
      const key = `${bookingId}:${booking.status}->${s}`;
      if (dismissedTransitions.current.has(key)) return false;
      const forStatus = checklist.filter((i) => i.requiredForStatus === s);
      return forStatus.length > 0 && forStatus.every((i) => i.state === 'COMPLETE');
    });
    if (targetStatus) setReadyDialogStatus(targetStatus);
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

  function dismissReadyDialog() {
    if (!booking || !readyDialogStatus) return;
    dismissedTransitions.current.add(`${bookingId}:${booking.status}->${readyDialogStatus}`);
    celebratoryTitle.current = CELEBRATORY_TITLES[Math.floor(Math.random() * CELEBRATORY_TITLES.length)];
    setReadyDialogStatus(null);
  }

  function confirmStatusTransition(status: BookingStatus) {
    setReadyDialogStatus(null);
    apiPatch<BookingDetail>(`/bookings/${bookingId}`, { status }).then(() => {
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
