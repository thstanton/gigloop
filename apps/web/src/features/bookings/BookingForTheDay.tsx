import { useState } from 'react';
import { Check, X, MapPin } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SectionHeader } from '@/components/common/SectionHeader';
import { IconButton } from '@/components/common/IconButton';
import { EmptyState } from '@/components/common/EmptyState';
import ContactPicker from '@/features/bookings/ContactPicker';
import VenueCard from '@/features/bookings/VenueCard';
import PerformanceSection from '@/features/bookings/PerformanceSection';
import MusicFormSection from '@/features/bookings/MusicFormSection';
import { apiPatch } from '@/lib/api';
import type { BookingDetail, Contact, Document, MusicFormConfig, MusicFormResponse } from '@/types/api';

// ─── InlineVenueAdd ──────────────────────────────────────────────────────────

function InlineVenueAdd({ bookingId }: { bookingId: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [venueId, setVenueId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (id: string) => apiPatch(`/bookings/${bookingId}`, { venueId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setEditing(false);
      setVenueId(null);
    },
  });

  if (!editing) {
    return (
      <EmptyState
        icon={<MapPin size={32} />}
        heading="No venue"
        description="Link a venue contact to this booking."
        action={
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm text-primary hover:underline"
          >
            + Add venue
          </button>
        }
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <ContactPicker
          value={venueId}
          onChange={setVenueId}
          placeholder="Select venue..."
          label="venue"
          preferredRole="VENUE"
        />
      </div>
      <button
        type="button"
        disabled={!venueId || mutation.isPending}
        onClick={() => { if (venueId) mutation.mutate(venueId); }}
        className="text-status-confirmed hover:text-status-confirmed/70 disabled:opacity-40 transition-colors flex-shrink-0"
        aria-label="Save venue"
      >
        <Check size={16} />
      </button>
      <IconButton label="Cancel" className="flex-shrink-0" onClick={() => { setEditing(false); setVenueId(null); }}>
        <X size={16} />
      </IconButton>
    </div>
  );
}

// ─── BookingForTheDay ─────────────────────────────────────────────────────────

interface Props {
  booking: BookingDetail;
  documents: Document[];
  musicFormConfig: MusicFormConfig | null;
  musicFormConfigLoading: boolean;
  musicFormResponse: MusicFormResponse | null;
  linkState: { from: string; label: string };
  onEditVenue: (contact: Contact) => void;
  onEditPerformance: () => void;
  onUpdateMusicFormConfig: () => void;
  onViewMusicFormResponse: () => void;
  onEditMusicForm: () => void;
}

export function BookingForTheDay({
  booking, documents,
  musicFormConfig, musicFormConfigLoading, musicFormResponse,
  linkState, onEditVenue, onEditPerformance,
  onUpdateMusicFormConfig, onViewMusicFormResponse, onEditMusicForm,
}: Props) {
  return (
    <section>
      <SectionHeader label="For the day" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <PerformanceSection booking={booking} onEdit={onEditPerformance} />
        {booking.venue
          ? <VenueCard venue={booking.venue} linkState={linkState} onEdit={() => onEditVenue(booking.venue!)} />
          : <InlineVenueAdd bookingId={booking.id} />
        }
        <div className={booking.venue ? 'sm:col-span-2' : undefined}>
          <MusicFormSection
            booking={booking}
            documents={documents}
            config={musicFormConfig}
            isLoading={musicFormConfigLoading}
            response={musicFormResponse}
            onUpdateConfig={onUpdateMusicFormConfig}
            onViewResponse={onViewMusicFormResponse}
            onEdit={onEditMusicForm}
          />
        </div>
      </div>
    </section>
  );
}
