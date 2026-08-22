import { BuilderSection } from '@/features/bookings/BuilderSection';
import { PeopleAtom, type PeopleSelection } from '@/features/bookings/PeopleAtom';
import { RemindMeAboutContainer } from '@/features/bookings/RemindMeAboutContainer';
import type { BookingDetail } from '@/types/api';
import type { useBookingBuilderMutations } from '@/features/bookings/useBookingBuilderMutations';

export function PeopleSection({
  booking,
  bookingId,
  peopleSave,
  refCallback,
}: {
  booking: BookingDetail;
  bookingId: string;
  peopleSave: ReturnType<typeof useBookingBuilderMutations>['peopleSave'];
  refCallback?: React.RefCallback<HTMLElement>;
}) {
  return (
    <BuilderSection id="people" title="People" refCallback={refCallback}>
      <PeopleAtom
        customer={booking.customer ?? null}
        agent={booking.bookingAgent ?? null}
        onSave={(sel: PeopleSelection) => peopleSave.mutate(sel)}
        isSaving={peopleSave.isPending}
        saved={peopleSave.isSuccess}
        saveError={peopleSave.isError ? 'Failed to save. Please try again.' : null}
      />
      <div className="mt-6">
        <RemindMeAboutContainer bookingId={bookingId} concern="people" currentStatus={booking.status} />
      </div>
    </BuilderSection>
  );
}
