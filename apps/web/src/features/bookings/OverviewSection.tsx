import { Button } from '@/components/ui/button';
import { BuilderSection } from '@/features/bookings/BuilderSection';
import { OverviewAtom } from '@/features/bookings/OverviewAtom';
import { RemindMeAboutContainer } from '@/features/bookings/RemindMeAboutContainer';
import type { BookingDetail, BookingSeries } from '@/types/api';
import type { useBookingBuilderMutations } from '@/features/bookings/useBookingBuilderMutations';

export function OverviewSection({
  booking,
  bookingId,
  seriesList,
  mutations,
  refCallback,
}: {
  booking: BookingDetail;
  bookingId: string;
  seriesList: BookingSeries[];
  mutations: ReturnType<typeof useBookingBuilderMutations>;
  refCallback?: React.RefCallback<HTMLElement>;
}) {
  const { overviewSave, seriesSave, seriesConfirmation, setSeriesConfirmation, seriesError, handleOverviewSave } = mutations;
  return (
    <BuilderSection id="overview" title="Overview" refCallback={refCallback}>
      <OverviewAtom
        initialEventType={booking.eventType}
        initialDate={booking.date.slice(0, 10)}
        initialFee={booking.fee}
        initialTitle={booking.title}
        initialSeriesId={booking.seriesId}
        series={seriesList}
        onSave={handleOverviewSave}
        isSaving={overviewSave.isPending || seriesSave.isPending}
        saved={!overviewSave.isPending && !seriesSave.isPending && (overviewSave.isSuccess || seriesSave.isSuccess)}
        saveError={seriesError ?? (overviewSave.isError ? 'Failed to save. Please try again.' : null)}
      />
      {seriesConfirmation && (
        <div className="mt-4 p-4 border border-border rounded-md bg-muted/30 space-y-3">
          <p className="text-sm">{seriesConfirmation.warning}</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                const { seriesId } = seriesConfirmation;
                setSeriesConfirmation(null);
                seriesSave.mutate({ seriesId, confirm: true });
              }}
              disabled={seriesSave.isPending}
            >
              {seriesSave.isPending ? 'Saving…' : 'Continue anyway'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSeriesConfirmation(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      <div className="mt-6">
        <RemindMeAboutContainer bookingId={bookingId} concern="overview" currentStatus={booking.status} />
      </div>
    </BuilderSection>
  );
}
