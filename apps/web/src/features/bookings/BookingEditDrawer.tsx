import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
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
import { apiDelete, apiPatch } from '@/lib/api';
import PerformanceEditor from './PerformanceEditor';
import MusicFormEditor from './MusicFormEditor';
import OnTheDayEditor from './OnTheDayEditor';
import { useFocusReturn } from '@/lib/hooks/useFocusReturn';
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
    bookingAgentId: booking.bookingAgentId,
    formatIds: [],
    seriesMode: 'none',
    seriesId: null,
    newSeriesLabel: '',
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  booking: BookingDetail;
}

export default function BookingEditDrawer({ booking }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const isOpen = searchParams.get('sheet') === 'bookingEdit';
  const section = searchParams.get('section');
  const queryClient = useQueryClient();
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const packagesRef = useRef<HTMLDivElement>(null);
  const musicFormRef = useRef<HTMLDivElement>(null);
  const onTheDayRef = useRef<HTMLDivElement>(null);

  const { capture, restore } = useFocusReturn();
  const previousIsOpen = useRef(false);
  useLayoutEffect(() => {
    if (isOpen && !previousIsOpen.current) {
      capture();
    }
    previousIsOpen.current = isOpen;
  }, [isOpen, capture]);

  function close() {
    setSearchParams({});
    restore();
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

  // Reset to current booking data each time the drawer opens
  useEffect(() => {
    if (isOpen) {
      reset(buildDefaultValues(booking));
      setDeleteConfirm(false);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps


  const deleteMutation = useMutation({
    mutationFn: () => apiDelete(`/bookings/${booking.id}`),
    onSuccess: () => {
      navigate('/admin/bookings');
    },
  });

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
        bookingAgentId: values.bookingAgentId,
      });
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
        onOpenAutoFocus={(e) => {
          if (!section) return;
          e.preventDefault();
          let ref: typeof packagesRef | null = null;
          if (section === 'packages') ref = packagesRef;
          else if (section === 'musicForm') ref = musicFormRef;
          else if (section === 'onTheDay') ref = onTheDayRef;
          if (!ref?.current) return;
          requestAnimationFrame(() => {
            ref.current!.scrollIntoView({ behavior: 'smooth', block: 'start' });
            const first = ref.current!.querySelector<HTMLElement>('input, select, textarea, button:not([disabled])');
            first?.focus({ preventScroll: true });
          });
        }}
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <SheetTitle>Edit booking</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
            <BookingFormFields
              control={control}
              register={register}
              errors={errors}
              hideNotes
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

          <div ref={onTheDayRef} className="mt-8 pt-6 border-t border-border">
            <OnTheDayEditor booking={booking} isOpen={isOpen} />
          </div>

          <div ref={packagesRef} className="mt-8 pt-6 border-t border-border">
            <PerformanceEditor booking={booking} isOpen={isOpen} />
          </div>

          <div ref={musicFormRef} className="mt-8 pt-6 border-t border-border">
            <MusicFormEditor booking={booking} isOpen={isOpen} />
          </div>

          <div className="mt-8 pt-6 border-t border-border">
            {deleteConfirm ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-status-cancelled border-status-cancelled hover:bg-status-cancelled/8"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                {deleteMutation.isPending ? 'Cancelling…' : 'Confirm cancellation'}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-status-cancelled border-status-cancelled hover:bg-status-cancelled/8"
                onClick={() => setDeleteConfirm(true)}
              >
                Cancel booking
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
