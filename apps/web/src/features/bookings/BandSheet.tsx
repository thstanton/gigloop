import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { BandAtom } from './BandAtom';
import { useBandMutations } from './useBandMutations';
import { useLineupTemplates } from '@/lib/hooks/useLineupTemplates';
import { useRoleVocabulary } from '@/lib/hooks/useRoleVocabulary';
import type { BookingBandChair, BookingBandMember, BookingLineup, BookingPackageSummary, Contact } from '@/types/api';

// Band members v1 (#879, ADR-0072 §6 / #885), rebuilt for #987 on #983's resolved design. Opened
// from the booking via ?sheet=band — the "change something" surface. Three cards: the bands on this
// gig, the people playing, and the parts still to fill.

interface Props {
  bookingId: string;
  lineups: BookingLineup[];
  chairs: BookingBandChair[];
  members: BookingBandMember[];
  packages: BookingPackageSummary[];
  venue: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BandSheet({ bookingId, lineups, chairs, members, packages, venue, open, onOpenChange }: Props) {
  const { data: lineupTemplates = [], isLoading: lineupTemplatesLoading } = useLineupTemplates(open);
  const instrumentVocabulary = useRoleVocabulary(open);

  const {
    applyLineup,
    setLineupSegments,
    removeLineup,
    addChair,
    removeChair,
    assignChair,
    updateMemberStatus,
    saveMemberFee,
  } = useBandMutations(bookingId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Band</SheetTitle>
        </SheetHeader>

        <div className="mt-4">
          <BandAtom
            bookingId={bookingId}
            lineups={lineups}
            chairs={chairs}
            members={members}
            packages={packages}
            venue={venue}
            instrumentVocabulary={instrumentVocabulary}
            lineupTemplates={lineupTemplates}
            lineupTemplatesLoading={lineupTemplatesLoading}
            onApplyLineup={(lineupTemplateId, packageIds) => applyLineup.mutate({ lineupTemplateId, packageIds })}
            isApplyingLineup={applyLineup.isPending}
            onSetLineupSegments={(lineupId, packageIds) => setLineupSegments.mutate({ lineupId, packageIds })}
            isSettingLineupSegments={setLineupSegments.isPending}
            onRemoveLineup={(lineupId) => removeLineup.mutate(lineupId)}
            removingLineupId={removeLineup.isPending ? (removeLineup.variables ?? null) : null}
            onAddChair={(role, lineupId) => addChair.mutate({ role, lineupId })}
            isAddingChair={addChair.isPending}
            onRemoveChair={(chairId) => removeChair.mutate(chairId)}
            removingChairId={removeChair.isPending ? (removeChair.variables ?? null) : null}
            onAssignChair={(chairId, contactId) => assignChair.mutate({ chairId, contactId })}
            assigningChairId={assignChair.isPending ? (assignChair.variables?.chairId ?? null) : null}
            onChangeMemberStatus={(memberId, status) => updateMemberStatus.mutate({ memberId, status })}
            changingStatusMemberId={updateMemberStatus.isPending ? (updateMemberStatus.variables?.memberId ?? null) : null}
            onSaveMemberFee={(memberId, sessionFee) => saveMemberFee.mutate({ memberId, sessionFee })}
            savingFeeMemberId={saveMemberFee.isPending ? (saveMemberFee.variables?.memberId ?? null) : null}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
