import { X } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { IconButton } from '@/components/common/IconButton';
import { Badge } from '@/components/ui/badge';
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
  members: BookingBandMember[];
  chairs: BookingBandChair[];
  lineups: BookingLineup[];
  /** Whether the booking has any packages — `callTimeParts`' discriminator for the package-less
   *  bucket ("Whole gig" versus a band parked with nothing to play yet, ADR-0081 §4). */
  hasPackages: boolean;
  onUnassignChair: (chairId: string) => void;
  onChangeStatus: (memberId: string, status: BookingBandMemberStatus) => void;
  changingStatusMemberId: string | null;
  onSaveFee: (memberId: string, sessionFee: number | null) => void;
  savingFeeMemberId: string | null;
}

export function PlayersCard({
  members,
  chairs,
  lineups,
  hasPackages,
  onUnassignChair,
  onChangeStatus,
  changingStatusMemberId,
  onSaveFee,
  savingFeeMemberId,
}: PlayersCardProps) {
  const nameBands = shouldNameBand(lineups);
  const lineupLabel = (lineupId: string) => {
    const lineup = lineups.find((l) => l.id === lineupId);
    return lineup ? lineupName(lineup) : undefined;
  };

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
    }));

  if (playing.length === 0) return null;

  return (
    <Card title="Players">
      <div>
        {playing.map(({ member, theirParts }) => (
          <div key={member.id} className="py-3 border-b border-border last:border-b-0">
            <div className="flex items-center gap-2 min-w-0">
                <span className="text-base font-semibold text-foreground truncate">{member.contact.name}</span>
                {member.isSelf && <Badge variant="outline">you</Badge>}
              </div>

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
              </div>

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
