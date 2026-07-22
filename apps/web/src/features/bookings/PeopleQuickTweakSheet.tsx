import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { apiPost, apiPatch } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { PeopleAtom, type PeopleSelection } from './PeopleAtom';
import type { Contact } from '@/types/api';

// PRD #511 Module B — the quick-tweak shell for the People atom. Hosts the Sheet-agnostic
// PeopleAtom and owns the orchestrated save. Tier-2 (per the #517 precedent): a save creates
// contacts and/or changes the booking, so success closes the sheet (the updated People card is
// the feedback) and failure toasts. Closing on success unmounts the atom, preventing a
// re-submit from double-creating a contact. Opened via ?sheet=peopleTweak.

interface Props {
  bookingId: string;
  customer: Contact | null;
  agent: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PeopleQuickTweakSheet({
  bookingId,
  customer,
  agent,
  open,
  onOpenChange,
}: Props) {
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async (selection: PeopleSelection): Promise<{ createdContact: boolean }> => {
      const patch: { customerId?: string; bookingAgentId?: string | null } = {};
      let createdContact = false;

      if (selection.customer) {
        if (selection.customer.kind === 'new') {
          const created = await apiPost<Contact>('/contacts', {
            ...selection.customer.contact,
            primaryRole: 'CUSTOMER',
          });
          patch.customerId = created.id;
          createdContact = true;
        } else if (selection.customer.contactId) {
          // Customer is required, so only a real id is ever assigned (the atom blocks clearing).
          patch.customerId = selection.customer.contactId;
        }
      }

      if (selection.agent) {
        if (selection.agent.kind === 'new') {
          const created = await apiPost<Contact>('/contacts', {
            ...selection.agent.contact,
            primaryRole: 'BOOKING_AGENT',
          });
          patch.bookingAgentId = created.id;
          createdContact = true;
        } else {
          // The agent is optional, so null (clear) is a valid assignment.
          patch.bookingAgentId = selection.agent.contactId;
        }
      }

      await apiPatch(`/bookings/${bookingId}`, patch);
      return { createdContact };
    },
    onSuccess: ({ createdContact }) => {
      if (createdContact) queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      onOpenChange(false);
    },
    onError: () => toast({ title: 'Failed to save people. Please try again.', variant: 'destructive' }),
  });

  function handleOpenChange(next: boolean) {
    if (!next) saveMutation.reset();
    onOpenChange(next);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>People</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <PeopleAtom
            customer={customer}
            agent={agent}
            onSave={(selection) => saveMutation.mutate(selection)}
            isSaving={saveMutation.isPending}
            saved={false}
            saveError={null}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
