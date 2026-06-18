import { useEffect, useRef, useState } from 'react';
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
import { toast } from '@/lib/hooks/use-toast';
import PerformanceEditor from './PerformanceEditor';
import MusicFormEditor from './MusicFormEditor';
import OnTheDayEditor from './OnTheDayEditor';
import { InlineContactBlock } from './InlineContactBlock';
import { InlineVenueBlock } from './InlineVenueBlock';
import { InlineAgentBlock } from './InlineAgentBlock';
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
    packageTemplateIds: [],
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
  const venueRef = useRef<HTMLDivElement>(null);

  // People save independently of the global form (per-box Save). Held as local
  // state so a transiently-empty customer can't block the global Save's validation.
  const [customerId, setCustomerId] = useState<string | null>(booking.customerId);
  const [venueId, setVenueId] = useState<string | null>(booking.venueId);
  const [bookingAgentId, setBookingAgentId] = useState<string | null>(booking.bookingAgentId);

  function close() {
    setSearchParams({});
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
      setCustomerId(booking.customerId);
      setVenueId(booking.venueId);
      setBookingAgentId(booking.bookingAgentId);
      setDeleteConfirm(false);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Per-box People saves: each PATCHes one association and invalidates the booking
  // so committedValue re-flows and the block's Save button clears.
  function usePeopleMutation(field: 'customerId' | 'venueId' | 'bookingAgentId', label: string) {
    return useMutation({
      mutationFn: (id: string | null) =>
        apiPatch<BookingDetail>(`/bookings/${booking.id}`, { [field]: id }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['booking', booking.id] });
        queryClient.invalidateQueries({ queryKey: ['bookings'] });
      },
      onError: () => toast({ title: `Failed to save ${label}. Please try again.`, variant: 'destructive' }),
    });
  }
  const customerMutation = usePeopleMutation('customerId', 'customer');
  const venueMutation = usePeopleMutation('venueId', 'venue');
  const agentMutation = usePeopleMutation('bookingAgentId', 'booking agent');


  const deleteMutation = useMutation({
    mutationFn: () => apiDelete(`/bookings/${booking.id}`),
    onSuccess: () => {
      navigate('/admin/bookings');
    },
    onError: () => toast({ title: 'Failed to cancel booking. Please try again.', variant: 'destructive' }),
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
          else if (section === 'venue') ref = venueRef;
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
              hidePeople
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

          {/* People — each block saves independently (per-box Save), separate from
              the global form above. */}
          <div className="mt-8 pt-6 border-t border-border space-y-4">
            <h2 className="text-sm font-semibold text-foreground">People</h2>
            <InlineContactBlock
              value={customerId}
              onChange={setCustomerId}
              committedValue={booking.customerId}
              onSave={(v) => customerMutation.mutate(v)}
              isSaving={customerMutation.isPending}
            />
            <div ref={venueRef}>
              <InlineVenueBlock
                value={venueId}
                onChange={setVenueId}
                committedValue={booking.venueId}
                onSave={(v) => venueMutation.mutate(v)}
                isSaving={venueMutation.isPending}
              />
            </div>
            <InlineAgentBlock
              value={bookingAgentId}
              onChange={setBookingAgentId}
              committedValue={booking.bookingAgentId}
              onSave={(v) => agentMutation.mutate(v)}
              isSaving={agentMutation.isPending}
            />
          </div>

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
