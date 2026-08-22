import { BuilderSection } from '@/features/bookings/BuilderSection';
import { VenueAtom, type VenueSelection } from '@/features/bookings/VenueAtom';
import { RemindMeAboutContainer } from '@/features/bookings/RemindMeAboutContainer';
import type { BookingDetail } from '@/types/api';
import type { useBookingBuilderMutations } from '@/features/bookings/useBookingBuilderMutations';

export function VenueSection({
  booking,
  bookingId,
  venueSave,
  refCallback,
}: {
  booking: BookingDetail;
  bookingId: string;
  venueSave: ReturnType<typeof useBookingBuilderMutations>['venueSave'];
  refCallback?: React.RefCallback<HTMLElement>;
}) {
  return (
    <BuilderSection id="venue" title="Venue" refCallback={refCallback}>
      <VenueAtom
        venue={booking.venue ?? null}
        onSave={(sel: VenueSelection) => venueSave.mutate(sel)}
        isSaving={venueSave.isPending}
        saved={venueSave.isSuccess}
        saveError={venueSave.isError ? 'Failed to save. Please try again.' : null}
      />
      <div className="mt-6">
        <RemindMeAboutContainer bookingId={bookingId} concern="venue" currentStatus={booking.status} />
      </div>
    </BuilderSection>
  );
}
