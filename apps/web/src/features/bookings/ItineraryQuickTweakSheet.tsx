import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { ItineraryAtom } from './ItineraryAtom';
import { NO_PACKAGE, type SetValues } from './ItineraryFields';
import { LOGISTICS_TIME_KEYS } from './DetailsAtom';
import type {
  ApplyPackageTemplateResponse,
  BookingDetail,
  BookingLogisticsEntry,
  BookingPackageSummary,
  MusicFormConfig,
  MusicFormSuggestion,
  PackageTemplate,
  PerformanceSet,
} from '@/types/api';

// PRD #511 Module B — the self-saving shell for the Itinerary atom (#521). It owns every mutation
// the atom signals (sets, packages, re-parenting, apply-template, and the time anchors) and fetches
// the package templates. Opened from the Itinerary card via ?sheet=itineraryTweak.
//
// The critical seam: the three time anchors live in the same `logistics` JSON as the non-temporal
// Details keys. So saving the anchors does the INVERSE of the Details merge — preserve every
// non-anchor key (Details fields + custom fields), overlay the anchor slice, then PATCH. Guarded by
// ItineraryQuickTweakSheet.spec.tsx.

/** Keep every non-anchor logistics key (Details + custom fields), so an anchor save never wipes them. */
function nonAnchorKeys(logistics: BookingDetail['logistics']): Record<string, BookingLogisticsEntry> {
  const out: Record<string, BookingLogisticsEntry> = {};
  const anchors = new Set<string>(LOGISTICS_TIME_KEYS);
  for (const [key, entry] of Object.entries(logistics ?? {})) {
    if (!anchors.has(key)) out[key] = entry;
  }
  return out;
}

function nextOrder(sets: PerformanceSet[]): number {
  return Math.max(0, ...sets.map((s) => s.order)) + 1;
}

interface Props {
  bookingId: string;
  eventType: string;
  sets: PerformanceSet[];
  packages: BookingPackageSummary[];
  currentLogistics: BookingDetail['logistics'];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ItineraryQuickTweakSheet({
  bookingId,
  eventType,
  sets,
  packages,
  currentLogistics,
  open,
  onOpenChange,
}: Props) {
  const queryClient = useQueryClient();
  const [pendingSuggestion, setPendingSuggestion] = useState<MusicFormSuggestion | null>(null);

  const invalidateBooking = () => {
    queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
  };

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['packages'],
    queryFn: () => apiGet<PackageTemplate[]>('/packages'),
    enabled: open,
  });

  const addSet = useMutation({
    mutationFn: ({ packageId, values }: { packageId: string | null; values: SetValues }) =>
      apiPost(`/bookings/${bookingId}/sets`, {
        order: nextOrder(sets),
        duration: values.duration,
        ...(values.startTime ? { startTime: values.startTime } : {}),
        ...(values.label ? { label: values.label } : {}),
        ...(packageId ? { packageId } : {}),
      }),
    onSuccess: invalidateBooking,
    onError: () => toast({ title: 'Failed to add set. Please try again.', variant: 'destructive' }),
  });

  const updateSet = useMutation({
    mutationFn: ({ setId, values }: { setId: string; values: SetValues }) =>
      apiPatch(`/bookings/${bookingId}/sets/${setId}`, values),
    onSuccess: invalidateBooking,
    onError: () => toast({ title: 'Failed to save set. Please try again.', variant: 'destructive' }),
  });

  const deleteSet = useMutation({
    mutationFn: (setId: string) => apiDelete(`/bookings/${bookingId}/sets/${setId}`),
    onSuccess: invalidateBooking,
    onError: () => toast({ title: 'Failed to delete set. Please try again.', variant: 'destructive' }),
  });

  const moveSet = useMutation({
    mutationFn: ({ setId, packageId }: { setId: string; packageId: string | null }) =>
      apiPatch(`/bookings/${bookingId}/sets/${setId}`, { packageId }),
    onSuccess: invalidateBooking,
    onError: () => toast({ title: 'Failed to move set. Please try again.', variant: 'destructive' }),
  });

  const applyTemplate = useMutation({
    mutationFn: (packageTemplateId: string) =>
      apiPost<ApplyPackageTemplateResponse>(`/bookings/${bookingId}/packages`, { packageTemplateId }),
    onSuccess: (data) => {
      invalidateBooking();
      // Apply-later suggestion (ADR-0046): when the music form is on, offer the template's moments/
      // genres — the musician accepts or dismisses; we never write them silently.
      if (data.suggestion && (data.suggestion.keyMoments.length || data.suggestion.genres.length)) {
        setPendingSuggestion(data.suggestion);
      }
    },
    onError: () => toast({ title: 'Failed to add package. Please try again.', variant: 'destructive' }),
  });

  const acceptSuggestion = useMutation({
    mutationFn: async (suggestion: MusicFormSuggestion) => {
      const config = await apiGet<MusicFormConfig>(`/bookings/${bookingId}/music-form-config`);
      const seen = new Set(config.keyMoments.map((km) => `${km.section} ${km.label}`));
      const mergedMoments = [
        ...config.keyMoments,
        ...suggestion.keyMoments.filter((km) => !seen.has(`${km.section} ${km.label}`)),
      ];
      const mergedGenres = Array.from(new Set([...config.enabledGenres, ...suggestion.genres]));
      return apiPut(`/bookings/${bookingId}/music-form-config`, {
        keyMoments: mergedMoments,
        enabledGenres: mergedGenres,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-music-form-config', bookingId] });
      setPendingSuggestion(null);
    },
    onError: () => toast({ title: 'Failed to add suggestions. Please try again.', variant: 'destructive' }),
  });

  const updatePackage = useMutation({
    mutationFn: ({ packageId, dto }: { packageId: string; dto: { label?: string; icon?: string } }) =>
      apiPatch(`/bookings/${bookingId}/packages/${packageId}`, dto),
    onSuccess: invalidateBooking,
    onError: () => toast({ title: 'Failed to update package. Please try again.', variant: 'destructive' }),
  });

  const removePackage = useMutation({
    mutationFn: (packageId: string) => apiDelete(`/bookings/${bookingId}/packages/${packageId}`),
    onSuccess: invalidateBooking,
    onError: () => toast({ title: 'Failed to remove package. Please try again.', variant: 'destructive' }),
  });

  // Anchors — Tier-1 stay-open; the inverse merge preserves Details + custom keys.
  const saveAnchors = useMutation({
    mutationFn: (anchors: Record<string, BookingLogisticsEntry>) =>
      apiPatch(`/bookings/${bookingId}`, { logistics: { ...nonAnchorKeys(currentLogistics), ...anchors } }),
    onSuccess: invalidateBooking,
  });

  function handleOpenChange(next: boolean) {
    if (!next) {
      saveAnchors.reset();
      setPendingSuggestion(null);
    }
    onOpenChange(next);
  }

  // The box key (package id, or NO_PACKAGE) that an add is currently persisting to.
  const addingKey = addSet.isPending
    ? (addSet.variables?.packageId ?? NO_PACKAGE)
    : null;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Itinerary</SheetTitle>
        </SheetHeader>

        {pendingSuggestion && (
          <div className="mt-4 rounded border border-border bg-primary/5 p-3">
            <p className="mb-2 text-sm text-foreground">
              This package suggests{' '}
              {pendingSuggestion.keyMoments.length > 0 && (
                <span className="font-medium">{pendingSuggestion.keyMoments.length} key moment{pendingSuggestion.keyMoments.length === 1 ? '' : 's'}</span>
              )}
              {pendingSuggestion.keyMoments.length > 0 && pendingSuggestion.genres.length > 0 && ' and '}
              {pendingSuggestion.genres.length > 0 && (
                <span className="font-medium">{pendingSuggestion.genres.length} genre{pendingSuggestion.genres.length === 1 ? '' : 's'}</span>
              )}{' '}
              for the music form.
            </p>
            <div className="flex items-center gap-3">
              <Button size="sm" onClick={() => acceptSuggestion.mutate(pendingSuggestion)} disabled={acceptSuggestion.isPending}>
                {acceptSuggestion.isPending ? 'Adding…' : 'Add to music form'}
              </Button>
              <button
                type="button"
                onClick={() => setPendingSuggestion(null)}
                disabled={acceptSuggestion.isPending}
                className="text-sm text-muted transition-colors hover:text-foreground disabled:opacity-50"
              >
                Not now
              </button>
            </div>
          </div>
        )}

        <div className="mt-4">
          <ItineraryAtom
            sets={sets}
            packages={packages}
            initialLogistics={currentLogistics}
            eventType={eventType}
            templates={templates}
            templatesLoading={templatesLoading}
            onAddSet={(packageId, values) => addSet.mutate({ packageId, values })}
            onUpdateSet={(setId, values) => updateSet.mutate({ setId, values })}
            onDeleteSet={(setId) => deleteSet.mutate(setId)}
            onMoveSet={(setId, packageId) => moveSet.mutate({ setId, packageId })}
            onApplyTemplate={(templateId) => applyTemplate.mutate(templateId)}
            onUpdatePackage={(packageId, dto) => updatePackage.mutate({ packageId, dto })}
            onRemovePackage={(packageId) => removePackage.mutate(packageId)}
            onSaveAnchors={(anchors) => saveAnchors.mutate(anchors)}
            savingSetId={updateSet.isPending ? updateSet.variables?.setId ?? null : null}
            deletingSetId={deleteSet.isPending ? deleteSet.variables ?? null : null}
            movingSetId={moveSet.isPending ? moveSet.variables?.setId ?? null : null}
            addingKey={addingKey}
            isApplyingTemplate={applyTemplate.isPending}
            removingPackageId={removePackage.isPending ? removePackage.variables ?? null : null}
            anchorsSaving={saveAnchors.isPending}
            anchorsSaved={saveAnchors.isSuccess}
            anchorsError={saveAnchors.isError ? 'Failed to save times. Please try again.' : null}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
