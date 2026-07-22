import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Contact } from '@/types/api';
import { VenueFields, type VenueSelection } from './VenueFields';
import { AssignedContactCardContainer } from './AssignedContactCardContainer';

export type { VenueSelection, NewVenueData } from './VenueFields';

// PRD #511 Module B — the Venue section editor atom. Sheet-agnostic (one atom, three shells).
//
// ADR-0066 reversed this atom's original "assignment only" scope. It is now *inline-edit-primary*:
// with a venue assigned it renders AssignedContactCardContainer (which owns the contact PATCH),
// falling back to the assign-mode VenueFields core (pick an existing VENUE contact or inline-create
// one) when there is no venue or the musician asks to change it. So this atom composes a mutation —
// the "never owns a mutation" guarantee survives only in VenueFields, which is what keeps the New
// Booking create path (BookingFormFields → VenueFields directly) free of contact editing.
//
// One Save per box: "Save contact" in edit mode (container's PATCH /contacts), or the assignment
// Save in assign mode (host's PATCH /bookings). Clearing the picker + assignment Save is the route
// for *removing* a venue from a booking. A successful assignment returns to edit mode.

interface VenueAtomProps {
  /** The venue currently saved on the booking (null when unset). */
  venue: Contact | null;
  onSave: (selection: VenueSelection) => void;
  // Tier-1 assignment-save state, injected by the host.
  isSaving: boolean;
  saved: boolean;
  saveError: string | null;
}

type Mode = 'edit' | 'assign';

function isVenueDirty(selection: VenueSelection | null, initialVenueId: string | null): boolean {
  if (!selection) return false;
  if (selection.kind === 'new') return !!selection.venue.name.trim();
  return (selection.venueId ?? null) !== (initialVenueId ?? null);
}

export function VenueAtom({ venue, onSave, isSaving, saved, saveError }: VenueAtomProps) {
  const [mode, setMode] = useState<Mode>(venue ? 'edit' : 'assign');
  const [selection, setSelection] = useState<VenueSelection | null>(null);
  const saving = useRef(false);

  useEffect(() => {
    if (saved && saving.current) {
      setMode('edit');
      setSelection(null);
      saving.current = false;
    }
  }, [saved]);

  // A cleared picker ({ kind: 'existing', venueId: null }) is dirty against a set venue — that is
  // the "remove venue from booking" path, so it must be saveable.
  const canSave = isVenueDirty(selection, venue?.id ?? null);

  function handleSave() {
    if (!selection) return;
    saving.current = true;
    onSave(selection);
  }

  if (mode === 'edit' && venue) {
    return (
      <AssignedContactCardContainer
        contact={venue}
        roleLabel="Venue"
        contextRole="VENUE"
        onChangeContact={() => setMode('assign')}
      />
    );
  }

  return (
    <div className="space-y-3">
      <VenueFields initialVenueId={venue?.id ?? null} onChange={setSelection} />

      {/* Tier-1 inline save (CLAUDE.md Loading & Feedback): disabled + "Saving…" while pending,
          inline error below the action. */}
      <div className="flex items-center gap-3 pt-1">
        <Button type="button" onClick={handleSave} disabled={isSaving || !canSave}>
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
        {venue && (
          <Button type="button" variant="ghost" onClick={() => { setMode('edit'); setSelection(null); }}>
            Cancel
          </Button>
        )}
        {saveError && <p className="text-sm text-status-cancelled">{saveError}</p>}
      </div>
    </div>
  );
}
