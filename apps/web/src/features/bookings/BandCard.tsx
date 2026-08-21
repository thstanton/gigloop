import { useSearchParams } from 'react-router-dom';
import { Pencil, Plus, Users } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { GhostButton } from '@/components/common/GhostButton';
import { SubLabel } from '@/components/common/SubLabel';
import { Badge } from '@/components/ui/badge';
import PersonChip from './PersonChip';
import { segmentLabel } from './BandAtom';
import type {
  BookingBand,
  BookingBandChair,
  BookingBandMember,
  BookingBandMemberStatus,
  BookingPackageSummary,
} from '@/types/api';

// Band members v1 (#879, ADR-0072 §6, #887): the Info tab's *directory* — who these people are,
// how to reach them, who has answered. Availability is the structure (grouped by answer), not a
// badge on a flat list. Tapping a player reuses PersonChip's existing popover — no new one.
// Presentational: reads only the `band` block the host already holds, issues no fetch of its own.

type BandGroupKey = 'Confirmed' | 'Waiting on' | 'Still to sort';

const GROUP_ORDER: BandGroupKey[] = ['Confirmed', 'Waiting on', 'Still to sort'];

// ADDED/DECLINED both still need the organiser's attention — invite, or find a replacement —
// so both land in "Still to sort"; only an answered-and-accepted member is "Confirmed".
const STATUS_TO_GROUP: Record<BookingBandMemberStatus, BandGroupKey> = {
  ADDED: 'Still to sort',
  INVITED: 'Waiting on',
  CONFIRMED: 'Confirmed',
  DECLINED: 'Still to sort',
};

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

  const groups: Record<BandGroupKey, BookingBandMember[]> = {
    Confirmed: [],
    'Waiting on': [],
    'Still to sort': [],
  };
  for (const member of band.members) groups[STATUS_TO_GROUP[member.status]].push(member);

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
        {GROUP_ORDER.filter((key) => groups[key].length > 0).map((key) => (
          <div key={key} className="space-y-2">
            <SubLabel>{key}</SubLabel>
            <div className="flex flex-col gap-2">
              {groups[key].map((member) => (
                <PersonChip
                  key={member.id}
                  role={memberRoleLabel(member, band.chairs)}
                  contact={member.contact}
                  linkState={linkState}
                />
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
                  {chair.role} · {segmentLabel(chair, packages)}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
