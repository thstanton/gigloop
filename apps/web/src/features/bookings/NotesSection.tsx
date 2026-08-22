import { BuilderSection } from '@/features/bookings/BuilderSection';
import InlineNotes from '@/features/bookings/InlineNotes';
import type { BookingDetail } from '@/types/api';

export function NotesSection({
  booking,
  onSaveNotes,
  isNotesPending,
  refCallback,
}: {
  booking: BookingDetail;
  onSaveNotes: (notes: string) => void;
  isNotesPending: boolean;
  refCallback?: React.RefCallback<HTMLElement>;
}) {
  return (
    <BuilderSection id="notes" title="Notes" refCallback={refCallback}>
      <InlineNotes notes={booking.notes} onSave={onSaveNotes} isSaving={isNotesPending} />
    </BuilderSection>
  );
}
