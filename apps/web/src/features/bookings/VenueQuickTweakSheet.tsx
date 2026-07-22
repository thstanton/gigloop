import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { apiPost, apiPatch } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { VenueAtom, type VenueSelection } from './VenueAtom';
import type { Contact } from '@/types/api';

// PRD #511 Module B — the quick-tweak *shell* for the Venue atom. It hosts the Sheet-agnostic
// VenueAtom and injects the regime: the host owns the mutation, the atom only signals intent.
// Opened from the venue card's edit/add action via ?sheet=venueTweak.
//
// Tier-2 (CLAUDE.md): the save creates a contact and/or changes the booking — a state-changing
// action — so success *closes the sheet* (the updated venue card is the feedback) and failure
// toasts. Closing on success also unmounts the atom, which structurally prevents a re-submit
// from double-creating the contact. The atom keeps its Tier-1 inline-"Saved" props for when the
// Builder shell hosts it (which stays mounted); this shell simply doesn't use them.

interface Props {
  bookingId: string;
  /** The venue currently saved on the booking (null when unset). */
  venue: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VenueQuickTweakSheet({ bookingId, venue, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    // Inline-create folds into the save: create the VENUE contact, then assign it. A
    // pre-existing pick skips straight to the assign. One action either way.
    mutationFn: async (selection: VenueSelection): Promise<{ createdContact: boolean }> => {
      let venueId: string | null;
      let createdContact = false;
      if (selection.kind === 'new') {
        const created = await apiPost<Contact>('/contacts', {
          ...selection.venue,
          primaryRole: 'VENUE',
        });
        venueId = created.id;
        createdContact = true;
      } else {
        venueId = selection.venueId;
      }
      await apiPatch(`/bookings/${bookingId}`, { venueId });
      return { createdContact };
    },
    onSuccess: ({ createdContact }) => {
      if (createdContact) queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      onOpenChange(false);
    },
    onError: () => toast({ title: 'Failed to save venue. Please try again.', variant: 'destructive' }),
  });

  function handleOpenChange(next: boolean) {
    if (!next) saveMutation.reset();
    onOpenChange(next);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>Venue</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <VenueAtom
            venue={venue}
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
