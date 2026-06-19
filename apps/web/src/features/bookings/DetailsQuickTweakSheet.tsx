import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { apiPatch } from '@/lib/api';
import { DetailsAtom, LOGISTICS_TIME_KEYS, type DetailsLogistics } from './DetailsAtom';
import type { BookingDetail } from '@/types/api';

// PRD #511 Module B — the self-saving shell for the Details atom. Unlike the Venue/People shells
// (Tier-2: a save creates a contact, so they close on success to prevent a double-create), Details
// creates nothing, so this shell is **Tier-1 and stays open**: it drives the atom's `saved` /
// `saveError` props directly (inline "Saved" / inline error) and never closes on success.
//
// The critical wiring: `logistics` is a single JSON column the API overwrites wholesale, but it is
// shared with the Itinerary atom's time anchors (#521). So before PATCHing, the shell merges the
// atom's non-temporal slice OVER the preserved time keys — otherwise a Details save would wipe the
// arrival/soundcheck/finish times. Opened from the Details card via ?sheet=detailsTweak.

/** The Itinerary-owned time anchors, kept verbatim so a Details save never clobbers them. */
function preservedTimeKeys(logistics: BookingDetail['logistics']): DetailsLogistics {
  const out: DetailsLogistics = {};
  for (const key of LOGISTICS_TIME_KEYS) {
    const entry = logistics?.[key];
    if (entry) out[key] = entry;
  }
  return out;
}

interface Props {
  bookingId: string;
  /** The booking's current logistics — the source of the time keys to preserve. */
  currentLogistics: BookingDetail['logistics'];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DetailsQuickTweakSheet({ bookingId, currentLogistics, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: (detailsLogistics: DetailsLogistics) =>
      apiPatch(`/bookings/${bookingId}`, {
        logistics: { ...preservedTimeKeys(currentLogistics), ...detailsLogistics },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });

  function handleOpenChange(next: boolean) {
    if (!next) saveMutation.reset();
    onOpenChange(next);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Details</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <DetailsAtom
            initialLogistics={currentLogistics}
            onSave={(detailsLogistics) => saveMutation.mutate(detailsLogistics)}
            isSaving={saveMutation.isPending}
            saved={saveMutation.isSuccess}
            saveError={saveMutation.isError ? 'Failed to save details. Please try again.' : null}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
