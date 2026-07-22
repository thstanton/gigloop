import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Contact } from '@/types/api';
import { RoleField, type RoleSelection } from './PeopleFields';
import { AssignedContactCardContainer } from './AssignedContactCardContainer';

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
// Each role-box owns exactly one Save at a time: "Save contact" in edit mode (the container's own
// PATCH /contacts), or the assignment Save in assign mode (the host's PATCH /bookings, surfaced via
// onSave / isSaving / saved / saveError). A successful assignment returns that role to edit mode
// once the refetched booking arrives.

export type { RoleSelection, NewContactData } from './PeopleFields';

/** Only the role(s) the user actually changed are present, so the host PATCHes the minimum. */
export interface PeopleSelection {
  customer?: RoleSelection;
  agent?: RoleSelection;
}

interface PeopleAtomProps {
  /** The customer currently on the booking (required role; null only before one is assigned). */
  customer: Contact | null;
  /** The booking agent currently on the booking (optional role). */
  agent: Contact | null;
  onSave: (selection: PeopleSelection) => void;
  // Tier-1-capable assignment-save state, injected by the host (the quick-tweak shell closes on
  // success so leaves saved/saveError off; the Builder shell drives them).
  isSaving: boolean;
  saved: boolean;
  saveError: string | null;
}

type Mode = 'edit' | 'assign';

function isDirty(selection: RoleSelection | null, initialId: string | null): boolean {
  if (!selection) return false;
  if (selection.kind === 'new') return !!selection.contact.name.trim();
  return (selection.contactId ?? null) !== (initialId ?? null);
}

export function PeopleAtom({ customer, agent, onSave, isSaving, saved, saveError }: PeopleAtomProps) {
  const [customerMode, setCustomerMode] = useState<Mode>(customer ? 'edit' : 'assign');
  const [agentMode, setAgentMode] = useState<Mode>(agent ? 'edit' : 'assign');
  const [customerSel, setCustomerSel] = useState<RoleSelection | null>(null);
  const [agentSel, setAgentSel] = useState<RoleSelection | null>(null);
  // Which role's assignment is in flight — so only that box flips back on success, never yanking a
  // mid-selection out of the other box (the host's `saved` is shared across both roles).
  const savingRole = useRef<'customer' | 'agent' | null>(null);

  useEffect(() => {
    if (!saved) return;
    if (savingRole.current === 'customer') { setCustomerMode('edit'); setCustomerSel(null); }
    if (savingRole.current === 'agent') { setAgentMode('edit'); setAgentSel(null); }
    savingRole.current = null;
  }, [saved]);

  const customerDirty = isDirty(customerSel, customer?.id ?? null);
  const agentDirty = isDirty(agentSel, agent?.id ?? null);

  // Customer is required: an assignment that would leave it unset is not saveable.
  const customerWouldClear =
    customerDirty && customerSel?.kind === 'existing' && customerSel.contactId == null;
  const customerCanSave = customerDirty && !customerWouldClear;

  function saveCustomer() {
    if (!customerSel) return;
    savingRole.current = 'customer';
    onSave({ customer: customerSel });
  }
  function saveAgent() {
    if (!agentSel) return;
    savingRole.current = 'agent';
    onSave({ agent: agentSel });
  }

  return (
    <div className="space-y-4">
      {customerMode === 'edit' && customer ? (
        <AssignedContactCardContainer
          contact={customer}
          roleLabel="Customer"
          contextRole="CUSTOMER"
          onChangeContact={() => setCustomerMode('assign')}
        />
      ) : (
        <div className="space-y-3">
          <RoleField
            label="Customer"
            preferredRole="CUSTOMER"
            required
            variant="customer"
            initialContactId={customer?.id ?? null}
            onChange={setCustomerSel}
          />
          <div className="flex items-center gap-3 pt-1">
            <Button type="button" onClick={saveCustomer} disabled={isSaving || !customerCanSave}>
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
            {customer && (
              <Button type="button" variant="ghost" onClick={() => { setCustomerMode('edit'); setCustomerSel(null); }}>
                Cancel
              </Button>
            )}
            {customerWouldClear && (
              <p className="text-sm text-status-cancelled">A customer is required.</p>
            )}
            {saveError && <p className="text-sm text-status-cancelled">{saveError}</p>}
          </div>
        </div>
      )}

      {agentMode === 'edit' && agent ? (
        <AssignedContactCardContainer
          contact={agent}
          roleLabel="Booking agent"
          contextRole="BOOKING_AGENT"
          onChangeContact={() => setAgentMode('assign')}
        />
      ) : (
        <div className="space-y-3">
          <RoleField
            label="Booking agent"
            preferredRole="BOOKING_AGENT"
            required={false}
            variant="agent"
            initialContactId={agent?.id ?? null}
            onChange={setAgentSel}
          />
          <div className="flex items-center gap-3 pt-1">
            <Button type="button" onClick={saveAgent} disabled={isSaving || !agentDirty}>
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
            {agent && (
              <Button type="button" variant="ghost" onClick={() => { setAgentMode('edit'); setAgentSel(null); }}>
                Cancel
              </Button>
            )}
            {saveError && <p className="text-sm text-status-cancelled">{saveError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
