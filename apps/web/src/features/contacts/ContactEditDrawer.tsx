import { useState } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import ContactForm, { toContactPayload, contactToFormValues } from './ContactForm';
import type { ContactFormValues } from './ContactForm';
import { apiPatch, apiDelete } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import type { Contact, ContactDetail } from '@/types/api';

interface Props {
  contact: ContactDetail;
  /** Type-ahead suggestions for the band member fields (#886) — see ContactForm's roleVocabulary. */
  roleVocabulary?: string[];
}

export default function ContactEditDrawer({ contact, roleVocabulary = [] }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const isOpen = searchParams.get('edit') === 'true';
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  function close() {
    saveMutation.reset();
    // Preserve location.state (the booking back-nav) when dropping the ?edit param.
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('edit');
        return next;
      },
      { state: location.state },
    );
    setDeleteConfirm(false);
  }

  const saveMutation = useMutation({
    mutationFn: (values: ContactFormValues) =>
      apiPatch<Contact>(`/contacts/${contact.id}`, toContactPayload(values)),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        ['contact', contact.id],
        (prev: ContactDetail | undefined) => (prev ? { ...prev, ...updated } : updated),
      );
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      close();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiDelete(`/contacts/${contact.id}`),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['contact', contact.id] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      navigate('/admin/contacts');
    },
    onError: () => toast({ title: 'Failed to delete contact. It may have linked bookings.', variant: 'destructive' }),
  });

  const totalBookings =
    contact.customerBookings.length +
    contact.venueBookings.length +
    contact.bookingAgentBookings.length;
  const bandMemberCount = contact.bandMemberCount;
  const blocked = totalBookings > 0 || bandMemberCount > 0;

  // Mirrors ContactsService.delete's ConflictException copy (#886) — keep the two in sync.
  function deleteBlockedMessage(): string {
    const booking = `${totalBookings} booking${totalBookings === 1 ? '' : 's'}`;
    const roster = `the band roster for ${bandMemberCount} booking${bandMemberCount === 1 ? '' : 's'}`;
    if (totalBookings > 0 && bandMemberCount > 0) {
      return `This contact has ${booking} and is on ${roster}, and cannot be deleted.`;
    }
    if (bandMemberCount > 0) {
      return `This contact is on ${roster} and cannot be deleted.`;
    }
    return `This contact has ${booking} and cannot be deleted.`;
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) close(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg flex flex-col p-0"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <SheetTitle>Edit contact</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Form — key forces remount with fresh defaultValues each time drawer opens */}
          <ContactForm
            key={isOpen ? contact.updatedAt : 'closed'}
            defaultValues={contactToFormValues(contact)}
            onSubmit={(values) => saveMutation.mutate(values)}
            isPending={saveMutation.isPending}
            isError={saveMutation.isError}
            submitLabel="Save changes"
            onCancel={close}
            roleVocabulary={roleVocabulary}
          />

          {/* Delete section */}
          <div className="border-t border-border mt-10 pt-8">
            <p className="text-sm font-medium text-foreground mb-1">Delete contact</p>
            <p className="text-sm text-muted mb-4">
              {blocked ? deleteBlockedMessage() : 'Permanently removes this contact. This cannot be undone.'}
            </p>
            {deleteConfirm ? (
              <Button
                size="sm"
                variant="destructiveOutline"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Confirm delete'}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="destructiveOutline"
                disabled={blocked}
                onClick={() => setDeleteConfirm(true)}
              >
                Delete contact
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
