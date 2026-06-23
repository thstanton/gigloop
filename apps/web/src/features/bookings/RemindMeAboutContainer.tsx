import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { apiGet, apiPatch, apiPost } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import type { ApplicableReminder, BookingStatus, ReminderConcern } from '@/types/api';
import { RemindMeAbout, reminderRowId } from './RemindMeAbout';

// The container for the "Remind me about" control (Smart Reminders, ADR-0052 / #556). Fetches a
// concern's applicable reminders and wires the Tier-3 optimistic on/off toggle. Reused per concern
// (#557/#558) — the only inputs are the booking id and the concern.

const remindersKey = (bookingId: string, concern: ReminderConcern) =>
  ['bookingReminders', bookingId, concern] as const;

interface RemindMeAboutContainerProps {
  bookingId: string;
  concern: ReminderConcern;
  /** The booking's current status — lets the control collapse passed-stage reminders. */
  currentStatus?: BookingStatus;
}

export function RemindMeAboutContainer({ bookingId, concern, currentStatus }: RemindMeAboutContainerProps) {
  const { isLoaded } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = remindersKey(bookingId, concern);
  const [busyKeys, setBusyKeys] = useState<ReadonlySet<string>>(new Set());

  const { data: reminders = [] } = useQuery({
    queryKey,
    queryFn: () =>
      apiGet<ApplicableReminder[]>(`/bookings/${bookingId}/checklist/reminders?concern=${concern}`),
    enabled: isLoaded,
  });

  const setBusy = (id: string, busy: boolean) =>
    setBusyKeys((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });

  const toggle = useMutation({
    mutationFn: (reminder: ApplicableReminder) => {
      // Off → skip the existing item (itemId always present when on).
      if (reminder.on) return apiPatch(`/bookings/${bookingId}/checklist/${reminder.itemId}`, { state: 'SKIPPED' });
      // On, system reminder → un-skip or on-demand seed (the API handles both).
      if (reminder.key) return apiPost(`/bookings/${bookingId}/checklist/reminders/${reminder.key}/enable`, {});
      // On, custom item → un-skip the existing record.
      return apiPatch(`/bookings/${bookingId}/checklist/${reminder.itemId}`, { state: 'PENDING' });
    },
    onMutate: async (reminder) => {
      const id = reminderRowId(reminder);
      setBusy(id, true);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ApplicableReminder[]>(queryKey);
      // Optimistically flip `on`. The seed case has no itemId yet — onSettled refetch fills in the
      // real id/state, so we only flip the boolean here.
      queryClient.setQueryData<ApplicableReminder[]>(queryKey, (old) =>
        old?.map((r) => (reminderRowId(r) === id ? { ...r, on: !r.on } : r)) ?? [],
      );
      return { previous, id };
    },
    onError: (_err, _reminder, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast({ title: 'Failed to update reminder. Please try again.', variant: 'destructive' });
    },
    onSettled: async (_data, _err, _reminder, context) => {
      // The toggle mutates the checklist, which feeds the builder completeness rail and the
      // ChecklistSection — invalidate all three, not just this control's query.
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookingChecklist', bookingId] });
      // Hold the row disabled until the reminders refetch lands: the seed case replaces the
      // optimistic id-less row with the real seeded one, so re-enabling before that would expose
      // a row that can't yet be skipped (no itemId).
      await queryClient.invalidateQueries({ queryKey });
      if (context?.id) setBusy(context.id, false);
    },
  });

  // The "add your own" path (#559): create a custom checklist item tagged to this concern, so it
  // joins the concern's list. The selector includes concern-tagged customs, so a reminders refetch
  // surfaces it. Returns the mutation promise so the form can clear on success / keep draft on error.
  const addReminder = useMutation({
    mutationFn: (label: string) =>
      apiPost(`/bookings/${bookingId}/checklist`, { label, concern }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['bookingChecklist', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
    },
    onError: () => toast({ title: 'Failed to add reminder. Please try again.', variant: 'destructive' }),
  });

  return (
    <RemindMeAbout
      reminders={reminders}
      onToggle={(r) => toggle.mutate(r)}
      busyKeys={busyKeys}
      currentStatus={currentStatus}
      onAdd={(label) => addReminder.mutateAsync(label)}
    />
  );
}
