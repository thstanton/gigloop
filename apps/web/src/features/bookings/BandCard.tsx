import { useSearchParams } from 'react-router-dom';
import { Pencil, Plus, Users } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { GhostButton } from '@/components/common/GhostButton';
import { SubLabel } from '@/components/common/SubLabel';
import { Badge } from '@/components/ui/badge';
import PersonChip from './PersonChip';
import { segmentLabel } from './BandAtom';
import {
  BAND_MEMBER_ANSWER_GROUP,
  BAND_MEMBER_ANSWER_GROUP_ORDER,
  BAND_MEMBER_STATUS_LABELS,
  type BandMemberAnswerGroup,
} from '@/lib/constants';
import type { BookingBand, BookingBandChair, BookingBandMember, BookingPackageSummary } from '@/types/api';

// Band members v1 (#879, ADR-0072 §6, #887): the Info tab's *directory* — who these people are,
// how to reach them, who has answered. Availability is the structure (grouped by answer), not a
// badge on a flat list. Tapping a player reuses PersonChip's existing popover — no new one.
// Presentational: reads only the `band` block the host already holds, issues no fetch of its own.
//
// The answer-group each status belongs to is declared once, in lib/constants.ts's
// BAND_MEMBER_STATUSES table (CLAUDE.md: one declaration per vocabulary) — never redeclared here.

/** A member's role text for the chip: every distinct chair role they fill, "You" appended for isSelf. */
function memberRoleLabel(member: BookingBandMember, chairs: BookingBandChair[]): string {
  const roles = [...new Set(chairs.filter((c) => c.memberId === member.id).map((c) => c.role))];
  const roleText = roles.join(', ');
  if (!member.isSelf) return roleText || 'Band member';
  return roleText ? `${roleText} · You` : 'You';
}

interface BandCardProps {
  band: BookingBand;
  packages: BookingPackageSummary[];
  /** Client-derived from the `['lineups']` query (ADR-0073 §6) — kept off the booking response
   *  because it answers a different question ("does the musician have a reusable lineup at all")
   *  than the booking-level "does this booking have a band" fact the `band` block already carries. */
  hasLineupTemplates: boolean;
  linkState?: Record<string, string>;
}

export default function BandCard({ band, packages, hasLineupTemplates, linkState }: BandCardProps) {
  const [, setSearchParams] = useSearchParams();
  const openBandSheet = () => setSearchParams({ sheet: 'band' });

  if (band.chairs.length === 0 && band.members.length === 0) {
    return (
      <EmptyState
        icon={<Users size={24} />}
        heading="No band yet"
        description={
          hasLineupTemplates
            ? 'Apply a lineup, or add chairs one at a time.'
            : 'Add chairs to start building the roster.'
        }
        action={
          <GhostButton variant="primary" size="xs" icon={<Plus size={13} />} onClick={openBandSheet}>
            Add band
          </GhostButton>
        }
        className="h-full justify-center py-6"
      />
    );
  }

  const groups: Record<BandMemberAnswerGroup, BookingBandMember[]> = {
    Confirmed: [],
    'Waiting on': [],
    'Still to sort': [],
  };
  for (const member of band.members) groups[BAND_MEMBER_ANSWER_GROUP[member.status]].push(member);

  const vacantChairs = band.chairs.filter((c) => c.memberId == null);

  return (
    <Card
      title="Band"
      action={
        <GhostButton variant="primary" size="xs" icon={<Pencil size={13} />} onClick={openBandSheet}>
          Edit
        </GhostButton>
      }
    >
      <div className="space-y-4">
        {BAND_MEMBER_ANSWER_GROUP_ORDER.filter((key) => groups[key].length > 0).map((key) => (
          <div key={key} className="space-y-2">
            <SubLabel>{key}</SubLabel>
            <div className="flex flex-col gap-2">
              {groups[key].map((member) => (
                <div key={member.id} className="flex items-center gap-2">
                  <PersonChip role={memberRoleLabel(member, band.chairs)} contact={member.contact} linkState={linkState} />
                  {/* "Still to sort" holds both never-invited and declined members — a badge keeps
                      "who has answered" legible instead of flattening the two into one look. */}
                  {member.status === 'DECLINED' && <Badge variant="outline">{BAND_MEMBER_STATUS_LABELS.DECLINED}</Badge>}
                </div>
              ))}
            </div>
          </div>
        ))}

        {vacantChairs.length > 0 && (
          <div className="space-y-2">
            <SubLabel>Chairs to fill</SubLabel>
            <div className="flex flex-wrap gap-1.5">
              {vacantChairs.map((chair) => (
                <Badge key={chair.id} variant="outline">
                  {chair.role} · {segmentLabel(chair, band.lineups, packages)}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
