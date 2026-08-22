import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import type { OverviewChanges, SeriesChange } from '@/features/bookings/OverviewAtom';
import type { PeopleSelection } from '@/features/bookings/PeopleAtom';
import type { VenueSelection } from '@/features/bookings/VenueAtom';
import type { DetailsLogistics } from '@/features/bookings/DetailsAtom';
import { useItineraryMutations } from '@/features/bookings/useItineraryMutations';
import { DEFAULT_ENABLED_GENRES } from '@/lib/constants';
import { nonAnchorKeys, preservedTimeKeys, pluralPackages, isConfirmationRequired, hasSuggestionContent } from '@/features/bookings/builderHelpers';
import type {
  ApplyPackageTemplateResponse,
  BookingDetail,
  BookingLogisticsEntry,
  Contact,
  KeyMoment,
  MusicFormConfig,
  MusicFormSuggestion,
  UpdateBookingSeriesResponse,
} from '@/types/api';

// Every server-writing concern the Booking Builder's sections drive, plus the
// small bits of local state their mutation lifecycles own (series-change
// confirmation, the pending music-form suggestion banner, staged templates).
// All atoms run in self-saving (Tier-1) regime; row-level operations are
// immediate-persist (Tier-3).
export function useBookingBuilderMutations({ id, booking }: { id: string; booking: BookingDetail | undefined }) {
  const queryClient = useQueryClient();

  const [seriesConfirmation, setSeriesConfirmation] = useState<{ seriesId: string; warning: string } | null>(null);
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const [pendingSuggestion, setPendingSuggestion] = useState<MusicFormSuggestion | null>(null);
  // Package Templates step (#546): templates are STAGED, then applied together via one deliberate
  // action — no blind one-click apply (the apply is destructive: it creates Packages + Sets).
  const [stagedTemplateIds, setStagedTemplateIds] = useState<string[]>([]);

  function invalidateBooking() {
    queryClient.invalidateQueries({ queryKey: ['booking', id] });
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
  }

  function syncMusicFormConfig(data: MusicFormConfig) {
    queryClient.setQueryData(['booking-music-form-config', id], data);
    queryClient.invalidateQueries({ queryKey: ['booking-music-form-config', id] });
    queryClient.invalidateQueries({ queryKey: ['booking', id] });
  }

  // ── Overview mutations ─────────────────────────────────────────────────────

  const overviewSave = useMutation({
    mutationFn: (changes: Omit<OverviewChanges, 'series'>) => apiPatch(`/bookings/${id}`, changes),
    onSuccess: invalidateBooking,
    onError: () => {},
  });

  const seriesSave = useMutation({
    mutationFn: (payload: { seriesId?: string | null; newSeriesLabel?: string; confirm?: boolean }) =>
      apiPatch<UpdateBookingSeriesResponse | object>(`/bookings/${id}/series`, payload),
    onSuccess: (result, vars) => {
      if (isConfirmationRequired(result)) {
        setSeriesConfirmation({ seriesId: vars.seriesId!, warning: result.warning });
        return;
      }
      invalidateBooking();
      queryClient.invalidateQueries({ queryKey: ['series'] });
      setSeriesError(null);
    },
    onError: (error) => {
      const msg = error instanceof ApiError && error.status === 409
        ? 'This booking has non-VOID invoices. Void or delete them before adding to a series.'
        : 'Failed to update series assignment. Please try again.';
      setSeriesError(msg);
    },
  });

  function handleOverviewSave(changes: OverviewChanges) {
    const { series, ...rest } = changes;
    setSeriesError(null);
    setSeriesConfirmation(null);
    if (Object.keys(rest).length > 0) overviewSave.mutate(rest);
    if (series) dispatchSeriesChange(series);
  }

  function dispatchSeriesChange(series: SeriesChange, confirm?: boolean) {
    if (series.mode === 'none')     seriesSave.mutate({ seriesId: null });
    else if (series.mode === 'existing') seriesSave.mutate({ seriesId: series.seriesId, confirm });
    else                            seriesSave.mutate({ newSeriesLabel: series.label });
  }

  // ── People mutations ───────────────────────────────────────────────────────

  // Customer is a required role: an 'existing' selection only patches when a
  // contact was actually picked (a null contactId is a no-op, not a clear).
  async function resolveCustomerPatch(customer: PeopleSelection['customer']): Promise<{ customerId?: string }> {
    if (!customer) return {};
    if (customer.kind === 'new') {
      const c = await apiPost<Contact>('/contacts', { ...customer.contact, primaryRole: 'CUSTOMER' });
      return { customerId: c.id };
    }
    return customer.contactId ? { customerId: customer.contactId } : {};
  }

  // Booking agent is optional: an 'existing' selection always patches, since a
  // null contactId here is a deliberate "unassign the agent".
  async function resolveAgentPatch(agent: PeopleSelection['agent']): Promise<{ bookingAgentId?: string | null }> {
    if (!agent) return {};
    if (agent.kind === 'new') {
      const c = await apiPost<Contact>('/contacts', { ...agent.contact, primaryRole: 'BOOKING_AGENT' });
      return { bookingAgentId: c.id };
    }
    return { bookingAgentId: agent.contactId };
  }

  const peopleSave = useMutation({
    mutationFn: async (selection: PeopleSelection): Promise<void> => {
      const patch = {
        ...(await resolveCustomerPatch(selection.customer)),
        ...(await resolveAgentPatch(selection.agent)),
      };
      await apiPatch(`/bookings/${id}`, patch);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contacts'] }); invalidateBooking(); },
    onError: () => toast({ title: 'Failed to save people. Please try again.', variant: 'destructive' }),
  });

  // ── Venue mutations ────────────────────────────────────────────────────────

  const venueSave = useMutation({
    mutationFn: async (selection: VenueSelection): Promise<void> => {
      let venueId: string | null;
      if (selection.kind === 'new') {
        const c = await apiPost<Contact>('/contacts', { ...selection.venue, primaryRole: 'VENUE' });
        venueId = c.id;
        queryClient.invalidateQueries({ queryKey: ['contacts'] });
      } else {
        venueId = selection.venueId;
      }
      await apiPatch(`/bookings/${id}`, { venueId });
    },
    onSuccess: invalidateBooking,
    onError: () => toast({ title: 'Failed to save venue. Please try again.', variant: 'destructive' }),
  });

  // ── Template mutations (Package Templates + Itinerary share the accept-suggestion path) ─

  const acceptSuggestion = useMutation({
    mutationFn: async (suggestion: MusicFormSuggestion) => {
      const config = await apiGet<MusicFormConfig>(`/bookings/${id}/music-form-config`);
      const seen = new Set(config.keyMoments.map((km) => `${km.section} ${km.label}`));
      return apiPut(`/bookings/${id}/music-form-config`, {
        keyMoments: [
          ...config.keyMoments,
          ...suggestion.keyMoments.filter((km) => !seen.has(`${km.section} ${km.label}`)),
        ],
        enabledGenres: Array.from(new Set([...config.enabledGenres, ...suggestion.genres])),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-music-form-config', id] });
      setPendingSuggestion(null);
    },
    onError: () => toast({ title: 'Failed to add suggestions. Please try again.', variant: 'destructive' }),
  });

  const applyStagedTemplates = useMutation({
    // Apply staged templates sequentially, merging their music-form suggestions into one banner.
    // Each apply is destructive (creates a Package + Sets), so a mid-batch failure must NOT lose
    // what already landed nor risk re-applying it: succeeded ids drop out and only the failed
    // remainder stays staged, so a retry applies just those (cf. the #543 contact-resolve cache).
    mutationFn: async (templateIds: string[]) => {
      let merged: MusicFormSuggestion | null = null;
      const failed: string[] = [];
      for (const packageTemplateId of templateIds) {
        try {
          const data = await apiPost<ApplyPackageTemplateResponse>(`/bookings/${id}/packages`, { packageTemplateId });
          const s = data.suggestion;
          if (s && hasSuggestionContent(s)) {
            merged = merged
              ? { genres: [...new Set([...merged.genres, ...s.genres])], keyMoments: [...merged.keyMoments, ...s.keyMoments] }
              : s;
          }
        } catch {
          failed.push(packageTemplateId);
        }
      }
      return { merged, failed };
    },
    onSuccess: ({ merged, failed }) => {
      invalidateBooking();
      setStagedTemplateIds(failed); // keep only what didn't land, so a retry can't double-apply
      if (merged) setPendingSuggestion(merged);
      if (failed.length) {
        toast({ title: `Couldn't apply ${pluralPackages(failed.length)}. Please try again.`, variant: 'destructive' });
      }
    },
  });

  const itineraryApplyTemplate = useMutation({
    mutationFn: (packageTemplateId: string) =>
      apiPost<ApplyPackageTemplateResponse>(`/bookings/${id}/packages`, { packageTemplateId }),
    onSuccess: (data) => {
      invalidateBooking();
      const s = data.suggestion;
      if (s && hasSuggestionContent(s)) setPendingSuggestion(s);
    },
    onError: () => toast({ title: 'Failed to add package. Please try again.', variant: 'destructive' }),
  });

  // ── Itinerary mutations ────────────────────────────────────────────────────

  const { addSet, updateSet, deleteSet, moveSet, updatePackage, removePackage } =
    useItineraryMutations(id, booking?.sets ?? []);

  const saveAnchors = useMutation({
    mutationFn: (anchors: Record<string, BookingLogisticsEntry>) =>
      apiPatch(`/bookings/${id}`, { logistics: { ...nonAnchorKeys(booking?.logistics ?? null), ...anchors } }),
    onSuccess: invalidateBooking,
  });

  // ── Details mutations ──────────────────────────────────────────────────────

  const detailsSave = useMutation({
    mutationFn: (detailsLogistics: DetailsLogistics) =>
      apiPatch(`/bookings/${id}`, {
        logistics: { ...preservedTimeKeys(booking?.logistics ?? null), ...detailsLogistics },
      }),
    onSuccess: invalidateBooking,
  });

  // ── Music mutations ────────────────────────────────────────────────────────

  const musicSave = useMutation({
    mutationFn: (payload: { keyMoments: KeyMoment[]; enabledGenres: string[] }) =>
      apiPut<MusicFormConfig>(`/bookings/${id}/music-form-config`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-music-form-config', id] });
    },
    onError: () => toast({ title: 'Failed to save music form. Please try again.', variant: 'destructive' }),
  });

  const musicPublish = useMutation({
    mutationFn: (payload: { keyMoments: KeyMoment[]; enabledGenres: string[] }) =>
      apiPost<MusicFormConfig>(`/bookings/${id}/music-form-config/publish`, payload),
    onSuccess: syncMusicFormConfig,
    onError: () => toast({ title: 'Failed to publish music form. Please try again.', variant: 'destructive' }),
  });

  const musicUnpublish = useMutation({
    mutationFn: () => apiPost<MusicFormConfig>(`/bookings/${id}/music-form-config/unpublish`, {}),
    onSuccess: syncMusicFormConfig,
    onError: () => toast({ title: 'Failed to un-publish music form. Please try again.', variant: 'destructive' }),
  });

  const musicTurnOn = useMutation({
    mutationFn: () =>
      apiPut<MusicFormConfig>(`/bookings/${id}/music-form-config`, { keyMoments: [], enabledGenres: DEFAULT_ENABLED_GENRES }),
    onSuccess: (data) => {
      queryClient.setQueryData<BookingDetail>(['booking', id], (old) =>
        old ? { ...old, hasMusicFormConfig: true } : old,
      );
      queryClient.setQueryData(['booking-music-form-config', id], data);
      queryClient.invalidateQueries({ queryKey: ['booking-music-form-config', id] });
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
    },
    onError: () => toast({ title: 'Failed to turn on music form. Please try again.', variant: 'destructive' }),
  });

  const musicTurnOff = useMutation({
    mutationFn: () => apiDelete(`/bookings/${id}/music-form-config`),
    onSuccess: () => {
      queryClient.setQueryData<BookingDetail>(['booking', id], (old) =>
        old ? { ...old, hasMusicFormConfig: false } : old,
      );
      queryClient.removeQueries({ queryKey: ['booking-music-form-config', id] });
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
    },
    onError: () => toast({ title: 'Failed to remove music form. Please try again.', variant: 'destructive' }),
  });

  return {
    seriesConfirmation, setSeriesConfirmation,
    seriesError,
    pendingSuggestion, setPendingSuggestion,
    stagedTemplateIds, setStagedTemplateIds,
    overviewSave, seriesSave, handleOverviewSave, dispatchSeriesChange,
    peopleSave,
    venueSave,
    acceptSuggestion, applyStagedTemplates, itineraryApplyTemplate,
    addSet, updateSet, deleteSet, moveSet, updatePackage, removePackage, saveAnchors,
    detailsSave,
    musicSave, musicPublish, musicUnpublish, musicTurnOn, musicTurnOff,
  };
}
