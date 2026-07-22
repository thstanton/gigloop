import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPatch } from '@/lib/api';
import { toContactPayload } from '@/features/contacts/ContactForm';
import type { ContactFormValues } from '@/features/contacts/ContactForm';
import type { Contact } from '@/types/api';
import { AssignedContactCard } from './AssignedContactCard';

type ContextRole = 'CUSTOMER' | 'VENUE' | 'BOOKING_AGENT';

interface Props {
  /** The contact assigned to this role on the booking. */
  contact: Contact;
  roleLabel: string;
  contextRole: ContextRole;
  /** The user wants to re-assign a different contact — the atom switches this role to assign mode. */
  onChangeContact: () => void;
}

/**
 * Owns the in-booking contact edit (ADR-0066 / #762). Follows the RemindMeAboutContainer precedent:
 * a container in features/bookings that owns the mutation and feeds a presentational card. It PATCHes
 * the contact and drives the card's Tier-1 save state. Failure surfaces inline through the card's
 * saveError prop (like ContactEditDrawer) — never a toast, never silent.
 */
export function AssignedContactCardContainer({ contact, roleLabel, contextRole, onChangeContact }: Props) {
  const queryClient = useQueryClient();
  const [dirty, setDirty] = useState(false);

  const saveMutation = useMutation({
    mutationFn: (values: ContactFormValues) =>
      apiPatch<Contact>(`/contacts/${contact.id}`, toContactPayload(values)),
    onSuccess: () => {
      // The API re-evaluates every affected booking's checklist server-side when the email changes
      // (contacts.service.ts) — but without these client invalidations the "Add the client's email"
      // step keeps nagging until reload, and the fix reads as broken. Prefix-match ['booking'] /
      // ['bookingChecklist'] (no id) so the atom stays booking-id-agnostic. Verified empirically in
      // the browser: the checklist step resolves without a reload.
      queryClient.invalidateQueries({ queryKey: ['contact', contact.id] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking'] });
      queryClient.invalidateQueries({ queryKey: ['bookingChecklist'] });
    },
  });

  return (
    <AssignedContactCard
      contact={contact}
      roleLabel={roleLabel}
      contextRole={contextRole}
      onSave={(values) => saveMutation.mutate(values)}
      onChangeContact={onChangeContact}
      isSaving={saveMutation.isPending}
      // Cleared on the next edit: setDirty(true) flips it off until a remount (post-refetch) reports
      // the fresh form clean again.
      saved={saveMutation.isSuccess && !dirty}
      saveError={saveMutation.isError}
      dirty={dirty}
      onDirtyChange={setDirty}
    />
  );
}
