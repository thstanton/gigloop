import { useState } from 'react';
import { Briefcase, MapPin, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ContactForm, { contactToFormValues } from '@/features/contacts/ContactForm';
import type { ContactFormValues } from '@/features/contacts/ContactForm';
import type { Contact } from '@/types/api';

type ContextRole = 'CUSTOMER' | 'VENUE' | 'BOOKING_AGENT';

const ROLE_ICON: Record<ContextRole, typeof User> = {
  CUSTOMER: User,
  BOOKING_AGENT: Briefcase,
  VENUE: MapPin,
};

export interface AssignedContactCardProps {
  /** The contact assigned to this role — prefills the embedded form. */
  contact: Contact;
  /** "Customer" / "Booking agent" / "Venue" — the header and the change-control label. */
  roleLabel: string;
  /** The booking role, driving the embedded form's venue carve-out (not the contact's primaryRole). */
  contextRole: ContextRole;
  /** The user wants this contact amended. Passed straight to the embedded form's submit. */
  onSave: (values: ContactFormValues) => void;
  /** The user wants to re-assign a different contact to this role instead. */
  onChangeContact: () => void;
  isSaving: boolean;
  saved: boolean;
  saveError: boolean;
  /**
   * Whether the embedded form has unsaved edits. When true, "Change …" first asks to discard
   * rather than re-assigning immediately. Controlled — the container derives it from the form.
   */
  dirty?: boolean;
  /** Forwarded to the embedded ContactForm so the container can track dirty state. */
  onDirtyChange?: (dirty: boolean) => void;
}

/**
 * The assigned-contact box for a booking's People/Venue section: shows the contact's details as
 * an editable embedded `ContactForm` (Tier-1 inline save) with a secondary "Change …" re-assign
 * control. Presentational and controlled — no fetch, no mutation; save state arrives as props and
 * intent leaves via `onSave` / `onChangeContact`. Wired up by its container in a later slice.
 */
export function AssignedContactCard({
  contact,
  roleLabel,
  contextRole,
  onSave,
  onChangeContact,
  isSaving,
  saved,
  saveError,
  dirty = false,
  onDirtyChange,
}: AssignedContactCardProps) {
  const [confirming, setConfirming] = useState(false);
  const Icon = ROLE_ICON[contextRole];

  // A dirty form must not be discarded silently: dirty routes "Change …" through the inline
  // confirm (ContactEditSheet idiom); a clean form re-assigns straight away.
  const onChangeClick = dirty ? () => setConfirming(true) : onChangeContact;

  return (
    <div className="border border-border rounded-md p-4 space-y-3">
      <div className="flex items-center gap-1.5">
        <Icon size={16} className="text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-semibold">{roleLabel}</p>
      </div>

      {/* key remounts the form with fresh values when the assigned contact changes underneath us */}
      <ContactForm
        key={contact.id + contact.updatedAt}
        embedded
        defaultValues={contactToFormValues(contact)}
        contextRole={contextRole}
        onSubmit={onSave}
        isPending={isSaving}
        isError={saveError}
        saved={saved}
        onDirtyChange={onDirtyChange}
        submitLabel="Save contact"
      />

      {confirming ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Discard changes and pick someone else?</p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setConfirming(false);
                onChangeContact();
              }}
            >
              Yes, change
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" size="sm" onClick={onChangeClick}>
          Change {roleLabel.toLowerCase()}
        </Button>
      )}
    </div>
  );
}
