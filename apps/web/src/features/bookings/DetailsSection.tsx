import { BuilderSection } from '@/features/bookings/BuilderSection';
import { DetailsAtom, type DetailsLogistics } from '@/features/bookings/DetailsAtom';
import { isEnabled } from '@/lib/featureFlags';
import type { BookingDetail } from '@/types/api';
import type { useBookingBuilderMutations } from '@/features/bookings/useBookingBuilderMutations';

export function DetailsSection({
  booking,
  detailsSave,
  refCallback,
}: {
  booking: BookingDetail;
  detailsSave: ReturnType<typeof useBookingBuilderMutations>['detailsSave'];
  refCallback?: React.RefCallback<HTMLElement>;
}) {
  return (
    <BuilderSection id="details" title="Details" refCallback={refCallback}>
      <DetailsAtom
        initialLogistics={booking.logistics}
        onSave={(detailsLogistics: DetailsLogistics) => detailsSave.mutate(detailsLogistics)}
        isSaving={detailsSave.isPending}
        saved={detailsSave.isSuccess}
        saveError={detailsSave.isError ? 'Failed to save details. Please try again.' : null}
        bandMembersEnabled={isEnabled('VITE_FEATURE_BAND_MEMBERS')}
      />
    </BuilderSection>
  );
}
