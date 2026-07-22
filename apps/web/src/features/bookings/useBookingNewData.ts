import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import type { UseFormSetValue } from 'react-hook-form';
import { apiGet } from '@/lib/api';
import type { BookingFormValues } from './BookingFormFields';
import type {
  BookingSeries,
  BookingStatus,
  ChecklistDefaultItem,
  PackageTemplate,
  ReminderPreview,
  UserProfile,
} from '@/types/api';

interface Params {
  /** The chosen starting status, once known — gates and keys the reminder preview (#560). */
  previewStatus: BookingStatus | undefined;
  setValue: UseFormSetValue<BookingFormValues>;
  /**
   * Whether the user has already edited `status` / `enableMusicForm`. The profile-default seed
   * below must not overwrite a field the user has touched: `/me` resolves late (see the effect),
   * so an unguarded seed silently reverts their choice (#730).
   */
  isStatusDirty: boolean;
  isMusicFormDirty: boolean;
}

// The reference data the New Booking form needs (profile, packages, series, reminder preview) plus
// the profile-driven defaults effect. Keeps the page a thin orchestrator (matches the booking
// detail surfaces, where children pull their own data via domain hooks).
export function useBookingNewData({ previewStatus, setValue, isStatusDirty, isMusicFormDirty }: Params) {
  const { isLoaded } = useAuth();

  const { data: userProfile } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<UserProfile>('/me'),
    enabled: isLoaded,
  });

  // Packages are performance structure, independent of the music form (ADR-0046) — offer them to
  // everyone, like the Builder (#546). The music-form *toggle* stays gated on the feature flag.
  const { data: formats, isLoading: isFormatsLoading } = useQuery({
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
  const { data: reminderPreview = [], isLoading: isPreviewLoading } = useQuery({
    queryKey: ['reminderPreview', previewStatus],
    queryFn: () => apiGet<ReminderPreview[]>(`/bookings/checklist/reminders/preview?status=${previewStatus}`),
    enabled: isLoaded && !!previewStatus,
  });

  // All prefills (customer/venue/agent/date/series) flow through defaultValues into the
  // controlled cores; only the profile-driven status/music-form defaults need a post-mount setValue.
  // `/me` is gated on Clerk init (`enabled: isLoaded`) plus a network round-trip (worse on Neon
  // cold-starts), so it can resolve AFTER the user has already picked a status — seeding only the
  // fields they haven't touched keeps a late resolution from silently reverting their choice (#730).
  useEffect(() => {
    if (!userProfile) return;
    if (!isStatusDirty) {
      const pref = (userProfile.preferences as { defaultBookingStatus?: string } | undefined)?.defaultBookingStatus ?? 'PROVISIONAL';
      setValue('status', pref as BookingFormValues['status']);
    }
    if (!isMusicFormDirty) {
      setValue('enableMusicForm', userProfile.songRequestFormEnabled);
    }
    // Deps intentionally exclude `userProfile` (keyed on its stable id, not refetch identity) and the
    // dirty flags (read at the moment /me resolves — re-running when they flip would re-clobber).
  }, [userProfile?.id, setValue]); // eslint-disable-line react-hooks/exhaustive-deps

  const checklistDefaults: ChecklistDefaultItem[] =
    userProfile?.preferences?.checklistDefaults || [];

  return { userProfile, formats, isFormatsLoading, seriesList, reminderPreview, isPreviewLoading, checklistDefaults };
}
