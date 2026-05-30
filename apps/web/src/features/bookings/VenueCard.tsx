import { ChevronRight, Car, KeyRound, Speaker } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/common/Card';
import type { Contact } from '@/types/api';

export interface VenueCardProps {
  venue: Contact;
  linkState?: Record<string, string>;
  onEdit: () => void;
}

export default function VenueCard({ venue, linkState, onEdit }: VenueCardProps) {
  return (
    <Card
      title="Venue"
      action={
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-primary hover:text-primary/80 transition-colors"
        >
          Edit
        </button>
      }
    >
      <Link
        to={`/admin/contacts/${venue.id}`}
        state={linkState}
        className="inline-flex items-center gap-1 group"
      >
        <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
          {venue.name}
        </span>
        <ChevronRight size={14} className="text-muted group-hover:text-primary transition-colors" />
      </Link>
      {(venue.email || venue.phone) && (
        <p className="text-sm text-muted mt-0.5">
          {venue.email && (
            <a href={`mailto:${venue.email}`} className="hover:text-primary transition-colors">{venue.email}</a>
          )}
          {venue.email && venue.phone && ' · '}
          {venue.phone && (
            <a href={`tel:${venue.phone}`} className="hover:text-primary transition-colors">{venue.phone}</a>
          )}
        </p>
      )}
      {venue.address && (
        <p className="text-sm text-muted mt-0.5 whitespace-pre-wrap">{venue.address}</p>
      )}
      {(venue.parkingInfo || venue.accessInfo || venue.equipmentAvailable) && (
        <div className="mt-3 pt-3 border-t border-border space-y-3">
          {venue.parkingInfo && (
            <div>
              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-0.5">
                <Car size={14} />
                Parking
              </div>
              <p className="text-sm text-foreground">{venue.parkingInfo}</p>
            </div>
          )}
          {venue.accessInfo && (
            <div>
              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-0.5">
                <KeyRound size={14} />
                Access
              </div>
              <p className="text-sm text-foreground">{venue.accessInfo}</p>
            </div>
          )}
          {venue.equipmentAvailable && (
            <div>
              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-0.5">
                <Speaker size={14} />
                Equipment
              </div>
              <p className="text-sm text-foreground">{venue.equipmentAvailable}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
