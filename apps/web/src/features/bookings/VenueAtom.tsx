import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { VenueFields, type VenueSelection } from './VenueFields';

// PRD #511 Module B — the Venue section editor atom (assignment only): composes the shared
// VenueFields core (pick an existing VENUE contact or inline-create a new one) with a Tier-1
// save row. It is Sheet-agnostic (one atom, three shells) and never owns a mutation: it
// surfaces the user's intent via `onSave(selection)` and renders its save state from props.

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
