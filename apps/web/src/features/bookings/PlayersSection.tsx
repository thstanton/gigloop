import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BandCommsComposeSheet } from './BandCommsComposeSheet';
import { BandInviteComposeSheet } from './BandInviteComposeSheet';
import { PlayersListCard } from './PlayersListCard';
import { useBandMutations } from './useBandMutations';
import type { BandCommunicationKind } from './bandCommunicationMeta';
import type { BookingBand, BookingPackageSummary } from '@/types/api';

// #1057: the container for the Info tab's Players card. It owns the mutations and the two compose
// sheets that used to hang off the Band sheet, so the card itself stays presentational and the Band
// sheet keeps no per-player action. `id="players"` is what a per-player checklist shortcut scrolls to
// (ADR-0084 §9).
export function PlayersSection({
  bookingId,
  band,
  packages,
  linkState,
}: {
  bookingId: string;
  band: BookingBand;
  packages: BookingPackageSummary[];
  linkState?: Record<string, string>;
}) {
  const [, setSearchParams] = useSearchParams();
  const [invitingMemberId, setInvitingMemberId] = useState<string | null>(null);
  const [composing, setComposing] = useState<{ memberId: string; kind: BandCommunicationKind } | null>(null);
  const [takingOffMemberId, setTakingOffMemberId] = useState<string | null>(null);
  const { assignChair, updateMemberStatus, saveMemberFee } = useBandMutations(bookingId);

  const inviteMember = band.members.find((m) => m.id === invitingMemberId) ?? null;
  const composeMember = band.members.find((m) => m.id === composing?.memberId) ?? null;

  // No bulk endpoint exists, so this is one vacate per part, stopping at the first failure (each
  // failed call already toasts). A partial failure leaves the player holding the remaining parts —
  // still listed, so the musician can simply try again.
  async function takeOff(memberId: string) {
    setTakingOffMemberId(memberId);
    try {
      for (const chair of band.chairs.filter((c) => c.memberId === memberId)) {
        await assignChair.mutateAsync({ chairId: chair.id, contactId: null });
      }
    } catch {
      // surfaced by assignChair's onError toast
    } finally {
      setTakingOffMemberId(null);
    }
  }

  return (
    <div id="players">
      <PlayersListCard
        band={band}
        packages={packages}
        backHref={`/admin/bookings/${bookingId}`}
        linkState={linkState}
        onOpenBandSheet={() => setSearchParams({ sheet: 'band' })}
        changingStatusMemberId={updateMemberStatus.isPending ? (updateMemberStatus.variables?.memberId ?? null) : null}
        savingFeeMemberId={saveMemberFee.isPending ? (saveMemberFee.variables?.memberId ?? null) : null}
        takingOffMemberId={takingOffMemberId}
        onInviteMember={setInvitingMemberId}
        onChangeStatus={(memberId, status) => updateMemberStatus.mutate({ memberId, status })}
        onSaveFee={(memberId, sessionFee) => saveMemberFee.mutate({ memberId, sessionFee })}
        onTakeOff={takeOff}
        onComposeCommunication={(memberId, kind) => setComposing({ memberId, kind })}
      />
      {inviteMember && (
        <BandInviteComposeSheet
          bookingId={bookingId}
          member={inviteMember}
          open
          onOpenChange={(next) => { if (!next) setInvitingMemberId(null); }}
        />
      )}
      {composeMember && composing && (
        <BandCommsComposeSheet
          bookingId={bookingId}
          member={composeMember}
          kind={composing.kind}
          open
          onOpenChange={(next) => { if (!next) setComposing(null); }}
        />
      )}
    </div>
  );
}
