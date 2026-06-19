import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { apiPatch } from '@/lib/api';
import { OverviewAtom, type OverviewChanges } from './OverviewAtom';
import type { EventType } from '@/types/api';

// PRD #511 Module B — the self-saving shell for the Overview atom. Like the Details shell it is
// Tier-1 and stays open: it drives the atom's saved/saveError props (inline "Saved" / inline error)
// and never closes on success. These are the booking's own scalar columns, so the save is a plain
// PATCH of the changed fields — no JSON-merge seam (unlike Details). Opened from the strip's ghost
// pencil via ?sheet=overviewTweak.

interface Props {
  bookingId: string;
  initialEventType: EventType;
  /** Date-only (YYYY-MM-DD). */
  initialDate: string;
  initialFee: string | null;
  initialTitle: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OverviewQuickTweakSheet({
  bookingId,
  initialEventType,
  initialDate,
  initialFee,
  initialTitle,
  open,
  onOpenChange,
}: Props) {
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: (changes: OverviewChanges) => apiPatch(`/bookings/${bookingId}`, changes),
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
          <SheetTitle>Overview</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <OverviewAtom
            initialEventType={initialEventType}
            initialDate={initialDate}
            initialFee={initialFee}
            initialTitle={initialTitle}
            onSave={(changes) => saveMutation.mutate(changes)}
            isSaving={saveMutation.isPending}
            saved={saveMutation.isSuccess}
            saveError={saveMutation.isError ? 'Failed to save. Please try again.' : null}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
