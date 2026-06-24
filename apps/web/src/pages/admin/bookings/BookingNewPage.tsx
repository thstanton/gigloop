import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { Button } from '@/components/ui/button';
import {
  BookingFormFields,
  bookingFormSchema,
  type BookingFormValues,
} from '@/features/bookings/BookingFormFields';
import { ChecklistStep } from '@/features/bookings/ChecklistStep';
import { CreatedCheckpoint } from '@/features/bookings/CreatedCheckpoint';
import type { RoleSelection } from '@/features/bookings/PeopleFields';
import type { VenueSelection } from '@/features/bookings/VenueFields';
import { EVENT_TYPE_LABELS } from '@/lib/constants';
import { apiGet, apiPost } from '@/lib/api';
import type {
  BookingDetail,
  BookingSeries,
  BookingStatus,
  ChecklistDefaultItem,
  Contact,
  EventType,
  PackageTemplate,
  ReminderPreview,
  UserProfile,
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

export default function BookingNewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { isLoaded } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  // Eager-created contact/venue ids are cached per submit attempt: mutationFn is the retry loop,
  // so without this a booking-POST failure + retry would re-POST /contacts and duplicate the
  // new contacts. `key in cache` distinguishes "resolved to undefined" (optional role left empty)
  // from "not yet resolved". Cleared on Back so editing a selection re-resolves it fresh.
  const resolvedIds = useRef<{ customerId?: string; bookingAgentId?: string; venueId?: string }>({});
  const [pendingValues, setPendingValues] = useState<BookingFormValues | null>(null);
  const [created, setCreated] = useState<BookingDetail | null>(null);

  const locationState = location.state as { customerId?: string; venueId?: string; bookingAgentId?: string; date?: string; seriesId?: string } | null;

  const { data: userProfile } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<UserProfile>('/me'),
    enabled: isLoaded,
  });

  // Packages are performance structure, independent of the music form (ADR-0046) — offer them to
  // everyone, like the Builder (#546). The music-form *toggle* stays gated on the feature flag.
  const { data: formats } = useQuery({
    queryKey: ['packages'],
    queryFn: () => apiGet<PackageTemplate[]>('/packages'),
    enabled: isLoaded,
  });

  const { data: seriesList } = useQuery({
    queryKey: ['series'],
    queryFn: () => apiGet<BookingSeries[]>('/series'),
    enabled: isLoaded,
  });

  // The per-concern reminders to offer on step 2, previewed for the chosen starting status (#560).
  // Runs the Builder's selector over the user's template server-side, so the create surface matches
  // the Builder without duplicating the concern/hint/phrase maps. Fetched once the status is known.
  const previewStatus = pendingValues?.status as BookingStatus | undefined;
  const { data: reminderPreview = [], isLoading: isPreviewLoading } = useQuery({
    queryKey: ['reminderPreview', previewStatus],
    queryFn: () => apiGet<ReminderPreview[]>(`/bookings/checklist/reminders/preview?status=${previewStatus}`),
    enabled: isLoaded && !!previewStatus,
  });

  const { control, handleSubmit, setValue, formState: { errors } } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      overview: {
        eventType: 'WEDDING',
        date: locationState?.date ?? '',
        fee: '',
        title: '',
        seriesMode: locationState?.seriesId ? 'existing' : 'none',
        seriesId: locationState?.seriesId ?? null,
        newSeriesLabel: '',
      },
      status: 'PROVISIONAL',
      notes: '',
      customer: { kind: 'existing', contactId: locationState?.customerId ?? null },
      bookingAgent: { kind: 'existing', contactId: locationState?.bookingAgentId ?? null },
      venue: { kind: 'existing', venueId: locationState?.venueId ?? null },
      packageTemplateIds: [],
      enableMusicForm: false,
    },
  });

  // All prefills (customer/venue/agent/date/series) flow through defaultValues into the
  // controlled cores; only the profile-driven status default needs a post-mount setValue.
  useEffect(() => {
    if (!userProfile) return;
    const pref = (userProfile.preferences as { defaultBookingStatus?: string } | undefined)?.defaultBookingStatus ?? 'PROVISIONAL';
    setValue('status', pref as BookingFormValues['status']);
    // Music form defaults on when the user has song request forms enabled (set once on profile load,
    // so a manual toggle afterwards is never clobbered — id is stable across refetches).
    setValue('enableMusicForm', userProfile.songRequestFormEnabled);
  }, [userProfile?.id, setValue]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: async ({ values, checklistItems }: { values: BookingFormValues; checklistItems: ChecklistDefaultItem[] }) => {
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
      // Failure surfaces inline via `mutation.isError` (ChecklistStep) — pinned to the Create
      // button, which beats an auto-dismissing toast for a form submit, so the handler is light.
      // Deliberately do NOT clear `resolvedIds` here: it's retained so a retry reuses the contacts
      // already created this attempt (see the ref comment above). Clearing it duplicates them.
    },
  });

  const checklistDefaults: ChecklistDefaultItem[] =
    userProfile?.preferences?.checklistDefaults || [];

  if (created) {
    return (
      <div className="px-6 py-8 max-w-3xl mx-auto">
        <CreatedCheckpoint
          title={created.title || EVENT_TYPE_LABELS[created.eventType]}
          onFinish={() => navigate(`/admin/bookings/${created.id}`)}
          onContinue={() => navigate(`/admin/bookings/${created.id}/builder`)}
        />
      </div>
    );
  }

  // The form stays mounted (hidden) while the checklist step shows, so the uncontrolled People/
  // Venue atom cores keep their typed new-contact state if the musician steps Back (ADR-0053).
  return (
    <>
      <div className={step === 2 ? 'hidden' : 'px-6 py-8 max-w-3xl mx-auto'}>
        <PageHeader title="New booking" backHref="/admin/bookings" backLabel="Bookings" />

        <form onSubmit={handleSubmit((values) => { setPendingValues(values); setStep(2); })} className="space-y-6">
          <BookingFormFields
            control={control}
            errors={errors}
            songRequestFormEnabled={userProfile?.songRequestFormEnabled}
            formats={formats}
            series={seriesList}
          />

          <div className="flex gap-3">
            <Button type="submit">
              Next: Checklist
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/admin/bookings')}>
              Cancel
            </Button>
          </div>
        </form>
      </div>

      {step === 2 && pendingValues && (
        <ChecklistStep
          preview={reminderPreview}
          isPreviewLoading={isPreviewLoading}
          checklistDefaults={checklistDefaults}
          startingStatus={pendingValues.status as BookingStatus}
          onBack={() => { mutation.reset(); resolvedIds.current = {}; setStep(1); }}
          onCreate={(checklistItems) => mutation.mutate({ values: pendingValues, checklistItems })}
          isCreating={mutation.isPending}
          isError={mutation.isError}
        />
      )}
    </>
  );
}
