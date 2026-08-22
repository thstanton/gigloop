import { BuilderSection } from '@/features/bookings/BuilderSection';
import { MusicAtom } from '@/features/bookings/MusicAtom';
import { RemindMeAboutContainer } from '@/features/bookings/RemindMeAboutContainer';
import type { BookingDetail, MusicFormConfig } from '@/types/api';
import type { useBookingBuilderMutations } from '@/features/bookings/useBookingBuilderMutations';

export function MusicSection({
  booking,
  bookingId,
  musicConfig,
  musicConfigLoading,
  mutations,
  refCallback,
}: {
  booking: BookingDetail;
  bookingId: string;
  musicConfig: MusicFormConfig | null;
  musicConfigLoading: boolean;
  mutations: ReturnType<typeof useBookingBuilderMutations>;
  refCallback?: React.RefCallback<HTMLElement>;
}) {
  const { musicSave, musicPublish, musicUnpublish, musicTurnOn, musicTurnOff } = mutations;
  return (
    <BuilderSection id="music" title="Music" refCallback={refCallback}>
      {/* Only mount the atom after the config query settles so its state initialises
          from the loaded config rather than from a null placeholder. */}
      {booking.hasMusicFormConfig && musicConfigLoading ? (
        <div className="h-16 bg-border rounded animate-pulse" />
      ) : (
        <MusicAtom
          hasMusicFormConfig={booking.hasMusicFormConfig}
          config={musicConfig}
          packages={booking.packages}
          onSave={(payload) => musicSave.mutate(payload)}
          onTurnOn={() => musicTurnOn.mutate()}
          onTurnOff={() => musicTurnOff.mutate()}
          isPublished={musicConfig?.publishedAt != null}
          onPublish={(payload) => musicPublish.mutate(payload)}
          onUnpublish={() => musicUnpublish.mutate()}
          isPublishing={musicPublish.isPending}
          isUnpublishing={musicUnpublish.isPending}
          isSaving={musicSave.isPending}
          saved={musicSave.isSuccess}
          saveError={musicSave.isError ? 'Failed to save music form. Please try again.' : null}
          isTurningOn={musicTurnOn.isPending}
          isTurningOff={musicTurnOff.isPending}
        />
      )}
      <div className="mt-6">
        <RemindMeAboutContainer bookingId={bookingId} concern="music" currentStatus={booking.status} />
      </div>
    </BuilderSection>
  );
}
