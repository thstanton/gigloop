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
}

// The reference data the New Booking form needs (profile, packages, series, reminder preview) plus
// the profile-driven defaults effect. Keeps the page a thin orchestrator (matches the booking
// detail surfaces, where children pull their own data via domain hooks).
export function useBookingNewData({ previewStatus, setValue }: Params) {
  const { isLoaded } = useAuth();

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
  const { data: reminderPreview = [], isLoading: isPreviewLoading } = useQuery({
    queryKey: ['reminderPreview', previewStatus],
    queryFn: () => apiGet<ReminderPreview[]>(`/bookings/checklist/reminders/preview?status=${previewStatus}`),
    enabled: isLoaded && !!previewStatus,
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

  const checklistDefaults: ChecklistDefaultItem[] =
    userProfile?.preferences?.checklistDefaults || [];

  return { userProfile, formats, seriesList, reminderPreview, isPreviewLoading, checklistDefaults };
}
