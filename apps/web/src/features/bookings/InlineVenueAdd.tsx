import { useSearchParams } from 'react-router-dom';
import { MapPin } from 'lucide-react';

/**
 * Venue empty state on the booking detail page. Opens the Venue quick-tweak atom
 * (PRD #511 Module B), where the musician can select an existing venue or create
 * one inline (VenuePlaceSearch) and save it in one Tier-1 action.
 */
export function InlineVenueAdd() {
  const [, setSearchParams] = useSearchParams();

  return (
    <div className="flex flex-col items-center justify-center text-center gap-2 py-4 text-muted min-h-[5rem]">
      <MapPin size={20} />
      <span className="text-sm font-medium">Venue</span>
      <button
        type="button"
        onClick={() => setSearchParams({ sheet: 'venueTweak' })}
        className="text-sm text-primary hover:text-primary/80 transition-colors"
      >
        + Add
      </button>
    </div>
  );
}
