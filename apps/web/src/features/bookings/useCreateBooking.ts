import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/lib/api';
import type { BookingFormValues } from './BookingFormFields';
import type { RoleSelection } from './PeopleFields';
import type { VenueSelection } from './VenueFields';
import type {
  BookingDetail,
  BookingStatus,
  ChecklistDefaultItem,
  Contact,
  EventType,
} from '@/types/api';

function buildSeriesPayload(overview: BookingFormValues['overview']): { seriesId?: string; newSeries?: { label: string } } {
  if (overview.seriesMode === 'existing' && overview.seriesId) return { seriesId: overview.seriesId };
  if (overview.seriesMode === 'new' && overview.newSeriesLabel.trim()) return { newSeries: { label: overview.newSeriesLabel.trim() } };
  return {};
}

interface ResolvedIds {
  customerId: string;
  bookingAgentId?: string;
  venueId?: string;
}

// The People/Venue atoms bubble an existing-or-new selection (ADR-0053). New contacts/venues
// eager-create here via POST /contacts before the atomic POST /bookings, which stays FK-only
// (ADR-0047). A `new` selection with an empty name resolves to "none" (optional roles only).
async function resolveContactId(
  sel: RoleSelection | undefined,
  role: 'CUSTOMER' | 'BOOKING_AGENT',
): Promise<string | undefined> {
  if (!sel) return undefined;
  if (sel.kind === 'existing') return sel.contactId ?? undefined;
  if (!sel.contact.name.trim()) return undefined;
  const created = await apiPost<Contact>('/contacts', { ...sel.contact, primaryRole: role });
  return created.id;
}

async function resolveVenueId(sel: VenueSelection | undefined): Promise<string | undefined> {
  if (!sel) return undefined;
  if (sel.kind === 'existing') return sel.venueId ?? undefined;
  if (!sel.venue.name.trim()) return undefined;
  const created = await apiPost<Contact>('/contacts', { ...sel.venue, primaryRole: 'VENUE' });
  return created.id;
}

function buildBookingPayload(
  values: BookingFormValues,
  ids: ResolvedIds,
  checklistItems: ChecklistDefaultItem[],
) {
  const { overview } = values;
  return {
    eventType: overview.eventType as EventType,
    date: overview.date,
    customerId: ids.customerId,
    status: values.status as BookingStatus,
    title: overview.title.trim() || undefined,
    fee: overview.fee.trim() ? parseFloat(overview.fee) : undefined,
    notes: values.notes || undefined,
    venueId: ids.venueId,
    bookingAgentId: ids.bookingAgentId,
    packageTemplateIds: values.packageTemplateIds.length ? values.packageTemplateIds : undefined,
    enableMusicForm: values.enableMusicForm,
    checklistItems,
    ...buildSeriesPayload(overview),
  };
}

interface CreateArgs {
  values: BookingFormValues;
  checklistItems: ChecklistDefaultItem[];
}

// Owns the atomic booking create for the New Booking form (ADR-0047 / ADR-0053): eager-create any
// `new` contact/venue, then the FK-only POST /bookings. Eager-created ids are cached per submit
// attempt in a ref — the mutationFn is the retry loop, so without this a booking-POST failure +
// retry would re-POST /contacts and duplicate the new contacts. `key in cache` distinguishes
// "resolved to undefined" (optional role left empty) from "not yet resolved". `reset()` clears the
// cache so editing a selection (e.g. stepping Back) re-resolves it fresh.
export function useCreateBooking() {
  const queryClient = useQueryClient();
  const resolvedIds = useRef<{ customerId?: string; bookingAgentId?: string; venueId?: string }>({});
  const [created, setCreated] = useState<BookingDetail | null>(null);

  const mutation = useMutation({
    mutationFn: async ({ values, checklistItems }: CreateArgs) => {
      // Eager-create any `new` contact/venue first, then the atomic FK-only booking POST. Each
      // resolution is cached so a retry after a failed booking POST never re-creates a contact.
      const cache = resolvedIds.current;
      if (!('customerId' in cache)) cache.customerId = await resolveContactId(values.customer, 'CUSTOMER');
      if (!('bookingAgentId' in cache)) cache.bookingAgentId = await resolveContactId(values.bookingAgent, 'BOOKING_AGENT');
      if (!('venueId' in cache)) cache.venueId = await resolveVenueId(values.venue);
      if (!cache.customerId) throw new Error('A customer is required.');
      return apiPost<BookingDetail>(
        '/bookings',
        buildBookingPayload(
          values,
          { customerId: cache.customerId, bookingAgentId: cache.bookingAgentId, venueId: cache.venueId },
          checklistItems,
        ),
      );
    },
    onSuccess: (booking) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      // Land on the commit checkpoint (slice #525) rather than jumping straight to the
      // booking — the musician chooses Finish or Continue setup from there.
      setCreated(booking);
    },
    onError: () => {
      // Failure surfaces inline via `isError` (ChecklistStep) — pinned to the Create button, which
      // beats an auto-dismissing toast for a form submit, so the handler is light. Deliberately do
      // NOT clear `resolvedIds` here: it's retained so a retry reuses the contacts already created
      // this attempt (see the ref comment above). Clearing it duplicates them.
    },
  });

  return {
    created,
    isCreating: mutation.isPending,
    isError: mutation.isError,
    create: (args: CreateArgs) => mutation.mutate(args),
    // Clears both the mutation result and the eager-create cache (used when stepping Back).
    reset: () => {
      mutation.reset();
      resolvedIds.current = {};
    },
  };
}
