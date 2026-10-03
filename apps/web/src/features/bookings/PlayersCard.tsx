import { X } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { IconButton } from '@/components/common/IconButton';
import { PartRow } from './PartRow';
import { callTimeParts, lineupName, rendersAsPlayer, shouldNameBand } from './bandParts';
import type { BookingBandChair, BookingBandMember, BookingLineup } from '@/types/api';

// #983's resolution, card 2 of 3, reduced by #1057: every per-player action (answer, fee, invite,
// sends, portal preview) moved to the Info tab's Players card (PlayersListCard). What stays here is
// the one thing that card cannot do — empty a single part of a player — until A5 (#1059) rebuilds
// this sheet one block per package. A full-width heading per person, then the parts they play.
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
}

export function PlayersCard({ members, chairs, lineups, hasPackages, onUnassignChair }: PlayersCardProps) {
  const nameBands = shouldNameBand(lineups);
  const lineupLabel = (lineupId: string) => {
    const lineup = lineups.find((l) => l.id === lineupId);
    return lineup ? lineupName(lineup, chairs) : undefined;
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
    <Card title="Who plays what">
      <div>
        {playing.map(({ member, theirParts }) => (
          <div key={member.id} className="py-3 border-b border-border last:border-b-0">
            <div className="flex items-center gap-2 min-w-0">
                <span className="text-base font-semibold text-foreground truncate">
                  {member.isSelf ? 'You' : member.contact.name}
                </span>
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
