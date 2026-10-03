import { Users } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { GhostButton } from '@/components/common/GhostButton';
import { SubLabel } from '@/components/common/SubLabel';
import { Button } from '@/components/ui/button';
import {
  BAND_MEMBER_ANSWER_GROUP,
  BAND_MEMBER_ANSWER_GROUP_ORDER,
  type BandMemberAnswerGroup,
} from '@/lib/constants';
import { PlayerRow } from './PlayerRow';
import { chairPackageIds, packageLabelsFor, playerMeta, rendersAsPlayer } from './bandParts';
import type { BandCommunicationKind } from './bandCommunicationMeta';
import type {
  BookingBand,
  BookingBandMemberStatus,
  BookingPackageSummary,
} from '@/types/api';

// #1057 / ADR-0084 §2 (artboard 2): the Info tab's Band card becomes the **Players card** — *where
// do I stand with each person*. A people list grouped by answer (Confirmed · Waiting on · Still to
// sort), then the parts nobody holds yet ("Still to fill"). "Still to fill" is parts, not a status,
// so it is its own block after the answer groups rather than a fourth row in the status table.
//
// Every per-player action lives on the row's `⋯`; the Band sheet keeps none of them. Presentational:
// no fetch, no mutation, no router state — the host wires every callback.

export interface PlayersListCardProps {
  band: BookingBand;
  packages: BookingPackageSummary[];
  /** Where "Preview {name}'s portal" returns to. */
  backHref: string;
  linkState?: Record<string, string>;
  /** Header link, "Find a player" and the empty state's CTA all open the Band sheet. */
  onOpenBandSheet: () => void;
  changingStatusMemberId: string | null;
  savingFeeMemberId: string | null;
  takingOffMemberId: string | null;
  onInviteMember: (memberId: string) => void;
  onChangeStatus: (memberId: string, status: BookingBandMemberStatus) => void;
  onSaveFee: (memberId: string, sessionFee: number | null) => void;
  /** Empties every part the player holds (the host decides how — there is no bulk endpoint yet). */
  onTakeOff: (memberId: string) => void;
  /** Temporary per-player sends until A4 (#1058) moves them to the card header. */
  onComposeCommunication: (memberId: string, kind: BandCommunicationKind) => void;
}

export function PlayersListCard({
  band,
  packages,
  backHref,
  linkState,
  onOpenBandSheet,
  changingStatusMemberId,
  savingFeeMemberId,
  takingOffMemberId,
  onInviteMember,
  onChangeStatus,
  onSaveFee,
  onTakeOff,
  onComposeCommunication,
}: PlayersListCardProps) {
  const { chairs, lineups } = band;
  const players = band.members.filter((m) => rendersAsPlayer(m, chairs));
  const vacantParts = chairs.filter((c) => c.memberId === null).sort((a, b) => a.order - b.order);

  if (players.length === 0 && vacantParts.length === 0) {
    return (
      <EmptyState
        icon={<Users size={24} />}
        heading="No players yet"
        description="Choose a lineup for each part of the day, then fill its parts."
        action={
          <GhostButton variant="primary" size="xs" onClick={onOpenBandSheet}>
            Choose a lineup
          </GhostButton>
        }
        className="h-full justify-center py-6"
      />
    );
  }

  const groups = Object.fromEntries(
    BAND_MEMBER_ANSWER_GROUP_ORDER.map((key) => [key, players.filter((m) => BAND_MEMBER_ANSWER_GROUP[m.status] === key)]),
  ) as Record<BandMemberAnswerGroup, typeof players>;

  return (
    <Card
      title="Players"
      action={
        <GhostButton variant="primary" size="xs" onClick={onOpenBandSheet}>
          Edit who plays what
        </GhostButton>
      }
    >
      <div className="space-y-4">
        {BAND_MEMBER_ANSWER_GROUP_ORDER.filter((key) => groups[key].length > 0).map((key) => (
          <div key={key} className="space-y-1">
            <SubLabel>{key}</SubLabel>
            <div>
              {groups[key].map((member) => (
                <PlayerRow
                  key={member.id}
                  member={member}
                  parts={chairs.filter((c) => c.memberId === member.id)}
                  meta={playerMeta(member.id, chairs, lineups, packages)}
                  backHref={backHref}
                  linkState={linkState}
                  isChangingStatus={changingStatusMemberId === member.id}
                  isSavingFee={savingFeeMemberId === member.id}
                  isTakingOff={takingOffMemberId === member.id}
                  onInvite={() => onInviteMember(member.id)}
                  onChangeStatus={(status) => onChangeStatus(member.id, status)}
                  onSaveFee={(fee) => onSaveFee(member.id, fee)}
                  onTakeOff={() => onTakeOff(member.id)}
                  onComposeCommunication={(kind) => onComposeCommunication(member.id, kind)}
                />
              ))}
            </div>
          </div>
        ))}

        {vacantParts.length > 0 && (
          <div className="space-y-1">
            <SubLabel>Still to fill</SubLabel>
            <div>
              {vacantParts.map((part) => (
                <div
                  key={part.id}
                  className="flex items-center gap-3 min-h-12 py-2 border-b border-border last:border-b-0"
                >
                  <span className="text-base font-semibold text-foreground">{part.role}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted">
                    {packageLabelsFor(chairPackageIds(part, lineups), packages).join(', ')}
                  </span>
                  <Button variant="outline" size="sm" className="min-h-11" onClick={onOpenBandSheet}>
                    Find a player
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
