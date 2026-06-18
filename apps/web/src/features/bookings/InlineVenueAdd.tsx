import { useSearchParams } from 'react-router-dom';
import { MapPin } from 'lucide-react';

/**
 * Venue empty state on the booking detail page. Opens the booking edit drawer
 * focused on the inline Venue block, where the musician can select an existing
 * venue or create one inline (VenuePlaceSearch). Replaces the old local sheet
 * that could only select an existing contact.
 */
export function InlineVenueAdd() {
  const [, setSearchParams] = useSearchParams();

  return (
    <div className="flex flex-col items-center text-center gap-2 py-4 text-muted min-h-[5rem]">
      <MapPin size={20} />
      <span className="text-sm font-medium">Venue</span>
      <button
        type="button"
        onClick={() => setSearchParams({ sheet: 'bookingEdit', section: 'venue' })}
        className="text-sm text-primary hover:text-primary/80 transition-colors"
      >
        + Add
      </button>
    </div>
  );
}
