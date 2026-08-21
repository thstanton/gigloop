import { useAuth } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { apiGet } from '@/lib/api';
import { BandAtom } from './BandAtom';
import { useBandMutations } from './useBandMutations';
import type { BookingBandChair, BookingPackageSummary, LineupTemplate } from '@/types/api';

// Band members v1 (#879, ADR-0072 §6 / #884). Opened from the booking via ?sheet=band — the
// "change something" surface. This slice renders the unfilled-chair block only; per-member rows
// arrive in #885.

interface Props {
  bookingId: string;
  chairs: BookingBandChair[];
  packages: BookingPackageSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BandSheet({ bookingId, chairs, packages, open, onOpenChange }: Props) {
  const { isLoaded } = useAuth();
  const { data: lineupTemplates = [], isLoading: lineupTemplatesLoading } = useQuery({
    queryKey: ['lineups'],
    queryFn: () => apiGet<LineupTemplate[]>('/lineups'),
    enabled: isLoaded && open,
  });

  const { applyLineup, addChair, removeChair, moveChair } = useBandMutations(bookingId, chairs);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Band</SheetTitle>
        </SheetHeader>

        <div className="mt-4">
          <BandAtom
            chairs={chairs}
            packages={packages}
            lineupTemplates={lineupTemplates}
            lineupTemplatesLoading={lineupTemplatesLoading}
            onApplyLineup={(lineupTemplateId, packageId) => applyLineup.mutate({ lineupTemplateId, packageId })}
            isApplyingLineup={applyLineup.isPending}
            onAddChair={(role, packageId) => addChair.mutate({ role, packageId })}
            isAddingChair={addChair.isPending}
            onRemoveChair={(chairId) => removeChair.mutate(chairId)}
            removingChairId={removeChair.isPending ? (removeChair.variables ?? null) : null}
            onMoveChair={moveChair}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
