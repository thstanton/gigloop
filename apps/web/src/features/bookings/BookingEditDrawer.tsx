import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  BookingFormFields,
  bookingFormSchema,
  type BookingFormValues,
} from './BookingFormFields';
import { apiDelete, apiPatch, apiPost } from '@/lib/api';
import type { BookingDetail, EventType, BookingStatus } from '@/types/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDefaultValues(booking: BookingDetail): BookingFormValues {
  return {
    eventType: booking.eventType as EventType,
    date: booking.date.slice(0, 10),
    status: booking.status as BookingStatus,
    title: booking.title ?? '',
    fee: booking.fee ?? '',
    notes: booking.notes ?? '',
    customerId: booking.customerId,
    venueId: booking.venueId,
    referrerId: booking.referrerId,
    sets: booking.sets.map((s) => ({
      id: s.id,
      label: s.label ?? '',
      duration: String(s.duration),
      startTime: s.startTime ?? '',
    })),
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  booking: BookingDetail;
}

export default function BookingEditDrawer({ booking }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const isOpen = searchParams.get('edit') === 'true';
  const queryClient = useQueryClient();

  function close() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('edit');
      return next;
    });
  }

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: buildDefaultValues(booking),
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'sets' });

  // Reset to current booking data each time the drawer opens
  useEffect(() => {
    if (isOpen) reset(buildDefaultValues(booking));
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: async (values: BookingFormValues) => {
      await apiPatch<BookingDetail>(`/bookings/${booking.id}`, {
        eventType: values.eventType as EventType,
        date: values.date,
        status: values.status as BookingStatus,
        title: values.title || null,
        fee: values.fee ? parseFloat(values.fee) : null,
        notes: values.notes || null,
        customerId: values.customerId,
        venueId: values.venueId,
        referrerId: values.referrerId,
      });

      // Reconcile sets: delete removed ones, patch/post remaining
      const keptSetIds = new Set(values.sets.map((s) => s.id).filter(Boolean));
      const deletedSetIds = booking.sets
        .filter((s) => !keptSetIds.has(s.id))
        .map((s) => s.id);

      await Promise.all([
        ...deletedSetIds.map((setId) =>
          apiDelete(`/bookings/${booking.id}/sets/${setId}`),
        ),
        ...values.sets.map((s, i) =>
          s.id
            ? apiPatch(`/bookings/${booking.id}/sets/${s.id}`, {
                order: i,
                duration: parseInt(s.duration, 10),
                startTime: s.startTime || null,
                label: s.label || null,
              })
            : apiPost(`/bookings/${booking.id}/sets`, {
                order: i,
                duration: parseInt(s.duration, 10),
                startTime: s.startTime || undefined,
                label: s.label || undefined,
              }),
        ),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', booking.id] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      close();
    },
  });

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) close(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg flex flex-col p-0"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <SheetTitle>Edit booking</SheetTitle>
        </SheetHeader>

        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="flex-1 overflow-y-auto px-6 py-6"
        >
          <BookingFormFields
            control={control}
            register={register}
            errors={errors}
            fields={fields}
            onAppendSet={() => append({ label: '', duration: '60', startTime: '' })}
            onRemoveSet={remove}
          />

          {mutation.isError && (
            <p className="mt-4 text-sm text-status-cancelled">
              Failed to save changes. Please try again.
            </p>
          )}

          <div className="flex gap-3 mt-6">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Save changes'}
            </Button>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
