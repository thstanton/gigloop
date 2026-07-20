import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { VenueFields, type VenueSelection } from './VenueFields';

// PRD #511 Module B — the Venue section editor atom. Sheet-agnostic (one atom, three shells).
//
// ADR-0066 reversed this atom's original "assignment only" scope. It is now *inline-edit-primary*:
// with a venue assigned it renders AssignedContactCardContainer (which owns the contact PATCH),
// falling back to the assign-mode VenueFields core (pick an existing VENUE contact or inline-create
// one) when there is no venue or the musician asks to change it. So this atom composes a mutation —
// the "never owns a mutation" guarantee survives only in VenueFields, which is what keeps the New
// Booking create path (BookingFormFields → VenueFields directly) free of contact editing.
//
// Assignment intent still surfaces via `onSave(selection)`; save state comes from props.

export type { VenueSelection, NewVenueData } from './VenueFields';

interface VenueAtomProps {
  /** The venue currently saved on the booking (null when unset). */
  initialVenueId: string | null;
  onSave: (selection: VenueSelection) => void;
  // Tier-1 save state, injected by the host.
  isSaving: boolean;
  saved: boolean;
  saveError: string | null;
}

function isVenueDirty(selection: VenueSelection | null, initialVenueId: string | null): boolean {
  if (!selection) return false;
  if (selection.kind === 'new') return !!selection.venue.name.trim();
  return (selection.venueId ?? null) !== (initialVenueId ?? null);
}

export function VenueAtom({ initialVenueId, onSave, isSaving, saved, saveError }: VenueAtomProps) {
  const [selection, setSelection] = useState<VenueSelection | null>(null);

  const canSave = isVenueDirty(selection, initialVenueId);

  function handleSave() {
    if (selection) onSave(selection);
  }

  return (
    <div className="space-y-3">
      <VenueFields initialVenueId={initialVenueId} onChange={setSelection} />

      {/* Tier-1 inline save (CLAUDE.md Loading & Feedback): disabled + "Saving…" while pending,
          inline "Saved" on success, inline error below the action. */}
      <div className="flex items-center gap-3 pt-1">
        <Button type="button" onClick={handleSave} disabled={isSaving || !canSave}>
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
        {saved && !isSaving && <span className="text-xs text-muted">Saved</span>}
        {saveError && <p className="text-sm text-status-cancelled">{saveError}</p>}
      </div>
    </div>
  );
}
