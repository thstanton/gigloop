import { Button } from '@/components/ui/button';
import { OverviewSection } from '@/features/bookings/OverviewSection';
import { PeopleSection } from '@/features/bookings/PeopleSection';
import { VenueSection } from '@/features/bookings/VenueSection';
import { TemplatesSection } from '@/features/bookings/TemplatesSection';
import { ItinerarySection } from '@/features/bookings/ItinerarySection';
import { DetailsSection } from '@/features/bookings/DetailsSection';
import { MusicSection } from '@/features/bookings/MusicSection';
import { NotesSection } from '@/features/bookings/NotesSection';
import type { useBookingFields } from '@/lib/hooks/useBookingFields';
import type { useBookingBuilderQueries } from '@/features/bookings/useBookingBuilderQueries';
import type { useBookingBuilderMutations } from '@/features/bookings/useBookingBuilderMutations';
import type { SpineId } from '@/features/bookings/builderCompleteness';
import type { BookingDetail } from '@/types/api';

// The eight spine concerns, in spine order, plus the mobile-only Done button
// that follows them. Split out of BookingBuilderPage (#992 follow-up) so the
// page's own function body stays a routing/composition-root shell rather
// than a 149-line prop-threading block.
export function BuilderSpineSections({
  booking,
  bookingId,
  fields,
  queries,
  mutations,
  registerSectionRef,
  onDone,
}: {
  booking: BookingDetail;
  bookingId: string;
  fields: ReturnType<typeof useBookingFields>;
  queries: ReturnType<typeof useBookingBuilderQueries>;
  mutations: ReturnType<typeof useBookingBuilderMutations>;
  registerSectionRef: Record<SpineId, React.RefCallback<HTMLElement>>;
  onDone: () => void;
}) {
  const { seriesList, templates, templatesLoading, musicConfig, musicConfigLoading } = queries;
  return (
    <div className="space-y-8">
      <OverviewSection
        booking={booking}
        bookingId={bookingId}
        seriesList={seriesList}
        mutations={mutations}
        refCallback={registerSectionRef.overview}
      />
      <PeopleSection
        booking={booking}
        bookingId={bookingId}
        peopleSave={mutations.peopleSave}
        refCallback={registerSectionRef.people}
      />
      <VenueSection
        booking={booking}
        bookingId={bookingId}
        venueSave={mutations.venueSave}
        refCallback={registerSectionRef.venue}
      />
      <TemplatesSection
        booking={booking}
        templates={templates}
        templatesLoading={templatesLoading}
        mutations={mutations}
        refCallback={registerSectionRef.templates}
      />
      <ItinerarySection
        booking={booking}
        bookingId={bookingId}
        templates={templates}
        templatesLoading={templatesLoading}
        mutations={mutations}
        refCallback={registerSectionRef.itinerary}
      />
      <DetailsSection
        booking={booking}
        detailsSave={mutations.detailsSave}
        refCallback={registerSectionRef.details}
      />
      <MusicSection
        booking={booking}
        bookingId={bookingId}
        musicConfig={musicConfig}
        musicConfigLoading={musicConfigLoading}
        mutations={mutations}
        refCallback={registerSectionRef.music}
      />
      <NotesSection
        booking={booking}
        onSaveNotes={(notes) => fields.updateNotes(notes)}
        isNotesPending={fields.isNotesPending}
        refCallback={registerSectionRef.notes}
      />

      {/* Mobile Done button */}
      <div className="flex justify-end pb-8 md:hidden">
        <Button onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}
