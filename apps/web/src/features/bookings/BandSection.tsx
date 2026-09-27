import { useState } from 'react';
import { BuilderSection } from '@/features/bookings/BuilderSection';
import { BandAtom } from '@/features/bookings/BandAtom';
import { BandInviteComposeSheet } from './BandInviteComposeSheet';
import { useBandMutations } from '@/features/bookings/useBandMutations';
import { useLineupTemplates } from '@/lib/hooks/useLineupTemplates';
import { useRoleVocabulary } from '@/lib/hooks/useRoleVocabulary';
import type { BookingDetail } from '@/types/api';

// #991 — the same BandAtom the Band sheet (BandSheet.tsx) wraps, composed as a Builder section
// instead of a Sheet. Byte-for-byte the same atom, no mode flag: this file only supplies the
// BuilderSection chrome and re-wires the identical query/mutation hooks BandSheet already uses, so
// the two homes can't diverge by construction (ADR-0081 §8 — reverses ADR-0072 §6's exclusion).
export function BandSection({
  booking,
  bookingId,
  refCallback,
}: {
  booking: BookingDetail;
  bookingId: string;
  refCallback?: React.RefCallback<HTMLElement>;
}) {
  const [invitingMemberId, setInvitingMemberId] = useState<string | null>(null);
  const { data: lineupTemplates = [], isLoading: lineupTemplatesLoading } = useLineupTemplates();
  const instrumentVocabulary = useRoleVocabulary();

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
  const inviteMember = booking.band.members.find((member) => member.id === invitingMemberId) ?? null;

  return (
    <>
      <BuilderSection id="band" title="Band" refCallback={refCallback}>
        <BandAtom
          bookingId={bookingId}
          lineups={booking.band.lineups}
          chairs={booking.band.chairs}
          members={booking.band.members}
          packages={booking.packages}
          venue={booking.venue}
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
          onInviteMember={setInvitingMemberId}
          onSaveMemberFee={(memberId, sessionFee) => saveMemberFee.mutate({ memberId, sessionFee })}
          savingFeeMemberId={saveMemberFee.isPending ? (saveMemberFee.variables?.memberId ?? null) : null}
        />
      </BuilderSection>
      {inviteMember && (
        <BandInviteComposeSheet
          bookingId={bookingId}
          member={inviteMember}
          open
          onOpenChange={(nextOpen) => { if (!nextOpen) setInvitingMemberId(null); }}
        />
      )}
    </>
  );
}
