import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RoleField, type RoleSelection } from './PeopleFields';

// PRD #511 Module B — the People section editor atom: composes the customer (required) and
// booking-agent (optional) roles into one editor. Like VenueAtom it is Sheet-agnostic.
//
// ADR-0066 reversed this atom's original "assignment only" scope. Each role is now *inline-edit-
// primary*: when a contact is assigned the atom renders AssignedContactCardContainer (which owns
// the contact PATCH), and only falls back to the assign-mode RoleField core when the role is
// empty or the musician asks to change it. So this atom does compose a mutation — the "owns no
// mutation" guarantee survives only in the field cores (PeopleFields), which is what keeps the
// New Booking create path (BookingFormFields → RoleField directly) free of contact editing.
//
// Assignment intent still surfaces via onSave(selection); the host injects the save state.

export type { RoleSelection, NewContactData } from './PeopleFields';

/** Only the role(s) the user actually changed are present, so the host PATCHes the minimum. */
export interface PeopleSelection {
  customer?: RoleSelection;
  agent?: RoleSelection;
}

interface PeopleAtomProps {
  initialCustomerId: string | null;
  initialAgentId: string | null;
  onSave: (selection: PeopleSelection) => void;
  // Tier-1-capable save state, injected by the host (the quick-tweak shell uses Tier-2 and
  // leaves saved/saveError off; the Builder shell can drive them).
  isSaving: boolean;
  saved: boolean;
  saveError: string | null;
}

function isDirty(selection: RoleSelection | null, initialId: string | null): boolean {
  if (!selection) return false;
  if (selection.kind === 'new') return !!selection.contact.name.trim();
  return (selection.contactId ?? null) !== (initialId ?? null);
}

export function PeopleAtom({
  initialCustomerId,
  initialAgentId,
  onSave,
  isSaving,
  saved,
  saveError,
}: PeopleAtomProps) {
  const [customerSel, setCustomerSel] = useState<RoleSelection | null>(null);
  const [agentSel, setAgentSel] = useState<RoleSelection | null>(null);

  const customerDirty = isDirty(customerSel, initialCustomerId);
  const agentDirty = isDirty(agentSel, initialAgentId);

  // Customer is required: a change that would leave it unset is not saveable.
  const customerWouldClear =
    customerDirty && customerSel?.kind === 'existing' && customerSel.contactId == null;
  const canSave = (customerDirty || agentDirty) && !customerWouldClear;

  function handleSave() {
    const selection: PeopleSelection = {};
    if (customerDirty && customerSel) selection.customer = customerSel;
    if (agentDirty && agentSel) selection.agent = agentSel;
    onSave(selection);
  }

  return (
    <div className="space-y-4">
      <RoleField
        label="Customer"
        preferredRole="CUSTOMER"
        required
        variant="customer"
        initialContactId={initialCustomerId}
        onChange={setCustomerSel}
      />
      <RoleField
        label="Booking agent"
        preferredRole="BOOKING_AGENT"
        required={false}
        variant="agent"
        initialContactId={initialAgentId}
        onChange={setAgentSel}
      />

      {/* Tier-1-capable inline save row; the quick-tweak shell drives it Tier-2 (close on
          success) and leaves saved/saveError unset. */}
      <div className="flex items-center gap-3 pt-1">
        <Button type="button" onClick={handleSave} disabled={isSaving || !canSave}>
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
        {saved && !isSaving && <span className="text-xs text-muted">Saved</span>}
        {customerWouldClear && (
          <p className="text-sm text-status-cancelled">A customer is required.</p>
        )}
        {saveError && <p className="text-sm text-status-cancelled">{saveError}</p>}
      </div>
    </div>
  );
}
