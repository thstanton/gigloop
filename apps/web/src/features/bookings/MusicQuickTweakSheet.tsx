import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api';
import { DEFAULT_ENABLED_GENRES } from '@/lib/constants';
import { toast } from '@/lib/hooks/use-toast';
import { MusicAtom, type MusicAtomSavePayload } from './MusicAtom';
import type { BookingDetail, BookingPackageSummary, MusicFormConfig } from '@/types/api';

// PRD #511 Module B — the quick-tweak shell for the Music atom. Mirrors the DetailsQuickTweakSheet
// pattern: a successful *save* closes the sheet (the updated Music card is the feedback) and failure
// toasts. Turn-on (PUT empty config) and turn-off (DELETE) are mode toggles, not saves — they keep
// the sheet open (turn-on so the musician can immediately configure) and are wired here so the atom
// stays mutation-free.
//
// Turn-on uses the same cache-priming approach as useConfigureMusicForm: the booking's
// hasMusicFormConfig is optimistically set to true so the atom transitions without a flash.
// Turn-off mirrors it in reverse. Opened via ?sheet=musicTweak.

interface Props {
  bookingId: string;
  hasMusicFormConfig: boolean;
  packages: BookingPackageSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MusicQuickTweakSheet({
  bookingId,
  hasMusicFormConfig,
  packages,
  open,
  onOpenChange,
}: Props) {
  const { isLoaded } = useAuth();
  const queryClient = useQueryClient();

  const { data: config = null } = useQuery({
    queryKey: ['booking-music-form-config', bookingId],
    queryFn: () => apiGet<MusicFormConfig>(`/bookings/${bookingId}/music-form-config`),
    enabled: isLoaded && hasMusicFormConfig && open,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: MusicAtomSavePayload) =>
      apiPut<MusicFormConfig>(`/bookings/${bookingId}/music-form-config`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-music-form-config', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      onOpenChange(false);
    },
    onError: () =>
      toast({ title: 'Failed to save music form. Please try again.', variant: 'destructive' }),
  });

  // #533: publish = save the current config AND make it client-visible (atomic). Unlike Save, it
  // keeps the sheet open so the musician sees it flip to the published state (slice #632 will chain
  // this into opening the send-invite sheet).
  const publishMutation = useMutation({
    mutationFn: (payload: MusicAtomSavePayload) =>
      apiPost<MusicFormConfig>(`/bookings/${bookingId}/music-form-config/publish`, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(['booking-music-form-config', bookingId], data);
      queryClient.invalidateQueries({ queryKey: ['booking-music-form-config', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
    },
    onError: () =>
      toast({ title: 'Failed to publish music form. Please try again.', variant: 'destructive' }),
  });

  const unpublishMutation = useMutation({
    mutationFn: () =>
      apiPost<MusicFormConfig>(`/bookings/${bookingId}/music-form-config/unpublish`, {}),
    onSuccess: (data) => {
      queryClient.setQueryData(['booking-music-form-config', bookingId], data);
      queryClient.invalidateQueries({ queryKey: ['booking-music-form-config', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
    },
    onError: () =>
      toast({ title: 'Failed to un-publish music form. Please try again.', variant: 'destructive' }),
  });

  const turnOnMutation = useMutation({
    mutationFn: () =>
      apiPut<MusicFormConfig>(`/bookings/${bookingId}/music-form-config`, {
        keyMoments: [],
        enabledGenres: DEFAULT_ENABLED_GENRES,
      }),
    onSuccess: (data) => {
      // Optimistically prime the cache so the atom transitions without waiting for the
      // booking refetch — same technique as useConfigureMusicForm.
      queryClient.setQueryData<BookingDetail>(['booking', bookingId], (old) =>
        old ? { ...old, hasMusicFormConfig: true } : old,
      );
      queryClient.setQueryData(['booking-music-form-config', bookingId], data);
      queryClient.invalidateQueries({ queryKey: ['booking-music-form-config', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
    },
    onError: () =>
      toast({ title: 'Failed to turn on music form. Please try again.', variant: 'destructive' }),
  });

  const turnOffMutation = useMutation({
    mutationFn: () => apiDelete(`/bookings/${bookingId}/music-form-config`),
    onSuccess: () => {
      queryClient.setQueryData<BookingDetail>(['booking', bookingId], (old) =>
        old ? { ...old, hasMusicFormConfig: false } : old,
      );
      queryClient.removeQueries({ queryKey: ['booking-music-form-config', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
    },
    onError: () =>
      toast({ title: 'Failed to remove music form. Please try again.', variant: 'destructive' }),
  });

  function handleOpenChange(next: boolean) {
    if (!next) saveMutation.reset();
    onOpenChange(next);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Music form</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <MusicAtom
            hasMusicFormConfig={hasMusicFormConfig}
            config={config}
            packages={packages}
            onSave={(payload) => saveMutation.mutate(payload)}
            onTurnOn={() => turnOnMutation.mutate()}
            onTurnOff={() => turnOffMutation.mutate()}
            isPublished={config?.publishedAt != null}
            onPublish={(payload) => publishMutation.mutate(payload)}
            onUnpublish={() => unpublishMutation.mutate()}
            isPublishing={publishMutation.isPending}
            isUnpublishing={unpublishMutation.isPending}
            isSaving={saveMutation.isPending}
            saved={false}
            saveError={null}
            isTurningOn={turnOnMutation.isPending}
            isTurningOff={turnOffMutation.isPending}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
