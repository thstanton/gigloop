import { Eye, Mail, X } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { IconButton } from '@/components/common/IconButton';
import { Button } from '@/components/ui/button';
import { BandMemberStatusDropdown } from './BandMemberStatusDropdown';
import InlineFeeAdd from './InlineFeeAdd';
import { PartRow } from './PartRow';
import { callTimeParts, lineupName, rendersAsPlayer, shouldNameBand } from './bandParts';
import type {
  BookingBandChair,
  BookingBandMember,
  BookingBandMemberStatus,
  BookingLineup,
} from '@/types/api';
import type { BandCommunicationKind } from './bandCommunicationMeta';

// #983's resolution, card 2 of 3. The **player** shape — a full-width heading, used for a person
// and nowhere else: name, then ONE status and ONE fee on a facts line, then the parts they play.
//
// ADR-0072 §2, and journey ②'s discriminator: someone holding a part in the ceremony solo AND the
// reception seven-piece is still one row here — one status, one fee, one confirmation, two part
// rows beneath. That is why this card is keyed by person and not by band.
//
// No per-person remove (#983): a player leaves by coming out of every part, and their row goes with
// the last one. `Players` is purely derived, which is what BookingBandMember being booking-scoped
// implies — a "remove from booking" button beside a "empty this part" button was two ✕ with
// different meanings on one person, which is most of what read as blurry.

interface PlayersCardProps {
  bookingId: string;
  members: BookingBandMember[];
  chairs: BookingBandChair[];
  lineups: BookingLineup[];
  /** Whether the booking has any packages — `callTimeParts`' discriminator for the package-less
   *  bucket ("Whole gig" versus a band parked with nothing to play yet, ADR-0081 §4). */
  hasPackages: boolean;
  onUnassignChair: (chairId: string) => void;
  onChangeStatus: (memberId: string, status: BookingBandMemberStatus) => void;
  changingStatusMemberId: string | null;
  onInviteMember: (memberId: string) => void;
  onComposeCommunication: (memberId: string, kind: BandCommunicationKind) => void;
  onSaveFee: (memberId: string, sessionFee: number | null) => void;
  savingFeeMemberId: string | null;
}

function invitationActionFor(member: BookingBandMember): { label: string; ariaLabel: string } {
  switch (member.status) {
    case 'ADDED':
      return { label: 'Invite', ariaLabel: `Send invitation to ${member.contact.name}` };
    case 'INVITED':
      return { label: 'Resend invite', ariaLabel: `Resend invitation to ${member.contact.name}` };
    case 'CONFIRMED':
    case 'DECLINED':
      return { label: 'Invitation', ariaLabel: `Invitation options for ${member.contact.name}` };
  }
  return { label: 'Invitation', ariaLabel: `Invitation options for ${member.contact.name}` };
}

export function PlayersCard({
  bookingId,
  members,
  chairs,
  lineups,
  hasPackages,
  onUnassignChair,
  onChangeStatus,
  changingStatusMemberId,
  onInviteMember,
  onComposeCommunication,
  onSaveFee,
  savingFeeMemberId,
}: PlayersCardProps) {
  const nameBands = shouldNameBand(lineups);
  const lineupLabel = (lineupId: string) => {
    const lineup = lineups.find((l) => l.id === lineupId);
    return lineup ? lineupName(lineup) : undefined;
  };
  const backHref = `/admin/bookings/${bookingId}`;

  // #983: `Players` is **purely derived** — a player leaves by coming out of every part, and their
  // row goes with the last one. That is what BookingBandMember being booking-scoped implies, and it
  // is why there is no per-person remove: emptying their last part IS the removal. Without this
  // filter a member row that holds no parts would render as a name with a status and no reason to
  // be there. The row survives server-side, so re-seating them restores one fee and one
  // confirmation rather than starting a second (ADR-0072 §2).
  const playing = members
    .filter((member) => rendersAsPlayer(member, chairs))
    .map((member) => ({
      member,
      theirParts: chairs.filter((c) => c.memberId === member.id).sort((a, b) => a.order - b.order),
      invitationAction: invitationActionFor(member),
    }));

  if (playing.length === 0) return null;

  return (
    <Card title="Players">
      <div>
        {playing.map(({ member, theirParts, invitationAction }) => (
          <div key={member.id} className="py-3 border-b border-border last:border-b-0">
            <div className="flex items-center gap-2 min-w-0">
                <span className="text-base font-semibold text-foreground truncate">
                  {member.isSelf ? 'You' : member.contact.name}
                </span>
              </div>

              {/* #1055 / ADR-0084 §7: nobody invites or pays themselves — your own row is CONFIRMED
                  the moment you are seated, so it carries no answer, fee, invite, send or preview. */}
              {!member.isSelf && (
                <div className="flex flex-wrap items-center gap-3 mt-1.5">
                  <BandMemberStatusDropdown
                    status={member.status}
                    memberName={member.contact.name}
                    onChange={(status) => onChangeStatus(member.id, status)}
                    isPending={changingStatusMemberId === member.id}
                  />
                  <InlineFeeAdd
                    value={member.sessionFee}
                    label={`fee for ${member.contact.name}`}
                    onSave={(sessionFee) => onSaveFee(member.id, sessionFee)}
                    isSaving={savingFeeMemberId === member.id}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-10"
                    onClick={() => onInviteMember(member.id)}
                    aria-label={invitationAction.ariaLabel}
                  >
                    <Mail size={14} />
                    {invitationAction.label}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-10"
                    onClick={() => onComposeCommunication(member.id, 'call-sheet')}
                    aria-label={`Send call sheet to ${member.contact.name}`}
                  >
                    Call sheet
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-10"
                    onClick={() => onComposeCommunication(member.id, 'final-details')}
                    aria-label={`Send final details to ${member.contact.name}`}
                  >
                    Final details
                  </Button>
                  {/* #980 — preview what this dep sees at their own /band/:token, before they're
                      invited. A plain link (not IconButton), matching the "Client portal" preview
                      link's shape (BookingHeader.tsx) rather than a mutation-triggering action. */}
                  <a
                    href={`/band/${member.bandPortalToken}?preview=admin&from=${encodeURIComponent(backHref)}`}
                    className="min-h-[44px] min-w-[44px] -my-2.5 inline-flex items-center justify-center text-muted hover:text-foreground transition-colors"
                    aria-label={`Preview ${member.contact.name}'s portal`}
                  >
                    <Eye size={14} />
                  </a>
                </div>
              )}

              <div className="mt-1">
                {theirParts.map((chair) => (
                  <PartRow
                    key={chair.id}
                    role={chair.role}
                    callTimes={callTimeParts(chair, hasPackages)}
                    bandName={nameBands ? lineupLabel(chair.lineupId) : undefined}
                    action={
                      <IconButton
                        label={`Empty the ${chair.role} part`}
                        onClick={() => onUnassignChair(chair.id)}
                        className="hover:text-status-cancelled"
                      >
                        <X size={14} />
                      </IconButton>
                    }
                  />
                ))}
              </div>
            </div>
        ))}
      </div>
    </Card>
  );
}
