import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { BandAtom } from './BandAtom';
import { useBandMutations } from './useBandMutations';
import { useLineupTemplates } from '@/lib/hooks/useLineupTemplates';
import { useRoleVocabulary } from '@/lib/hooks/useRoleVocabulary';
import type { BookingBandChair, BookingBandMember, BookingPackageSummary, Contact } from '@/types/api';

// Band members v1 (#879, ADR-0072 §6 / #885). Opened from the booking via ?sheet=band — the
// "change something" surface. One row per member with segment chips, plus the unfilled-chair block
// from #884.

interface Props {
  bookingId: string;
  chairs: BookingBandChair[];
  members: BookingBandMember[];
  packages: BookingPackageSummary[];
  venue: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BandSheet({ bookingId, chairs, members, packages, venue, open, onOpenChange }: Props) {
  const { data: lineupTemplates = [], isLoading: lineupTemplatesLoading } = useLineupTemplates(open);
  const instrumentVocabulary = useRoleVocabulary(open);

  const {
    applyLineup,
    addChair,
    removeChair,
    moveChair,
    assignChair,
    updateMemberStatus,
    saveMemberFee,
    removeMember,
  } = useBandMutations(bookingId, chairs);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Band</SheetTitle>
        </SheetHeader>

        <div className="mt-4">
          <BandAtom
            chairs={chairs}
            members={members}
            packages={packages}
            venue={venue}
            instrumentVocabulary={instrumentVocabulary}
            lineupTemplates={lineupTemplates}
            lineupTemplatesLoading={lineupTemplatesLoading}
            onApplyLineup={(lineupTemplateId, packageId) => applyLineup.mutate({ lineupTemplateId, packageId })}
            isApplyingLineup={applyLineup.isPending}
            onAddChair={(role, packageId) => addChair.mutate({ role, packageId })}
            isAddingChair={addChair.isPending}
            onRemoveChair={(chairId) => removeChair.mutate(chairId)}
            removingChairId={removeChair.isPending ? (removeChair.variables ?? null) : null}
            onMoveChair={moveChair}
            onAssignChair={(chairId, contactId) => assignChair.mutate({ chairId, contactId })}
            assigningChairId={assignChair.isPending ? (assignChair.variables?.chairId ?? null) : null}
            onChangeMemberStatus={(memberId, status) => updateMemberStatus.mutate({ memberId, status })}
            changingStatusMemberId={updateMemberStatus.isPending ? (updateMemberStatus.variables?.memberId ?? null) : null}
            onSaveMemberFee={(memberId, sessionFee) => saveMemberFee.mutate({ memberId, sessionFee })}
            savingFeeMemberId={saveMemberFee.isPending ? (saveMemberFee.variables?.memberId ?? null) : null}
            onRemoveMember={(memberId) => removeMember.mutate(memberId)}
            removingMemberId={removeMember.isPending ? (removeMember.variables ?? null) : null}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
