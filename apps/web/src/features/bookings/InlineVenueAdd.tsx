import { useSearchParams } from 'react-router-dom';
import { MapPin, Plus } from 'lucide-react';
import { GhostButton } from '@/components/common/GhostButton';
import { EmptyState } from '@/components/common/EmptyState';

/**
 * Venue empty state on the booking detail page. Opens the Venue quick-tweak atom
 * (PRD #511 Module B), where the musician can select an existing venue or create
 * one inline and save it in one Tier-1 action.
 */
export function InlineVenueAdd() {
  const [, setSearchParams] = useSearchParams();
  return (
    <EmptyState
      icon={<MapPin size={24} />}
      heading="No venue yet"
      description="Add a venue to include address and travel time in your booking."
      action={
        <GhostButton
          variant="primary"
          size="xs"
          icon={<Plus size={13} />}
          onClick={() => setSearchParams({ sheet: 'venueTweak' })}
        >
          Add venue
        </GhostButton>
      }
      className="h-full justify-center py-6"
    />
  );
}
