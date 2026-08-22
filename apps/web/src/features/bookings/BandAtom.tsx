import { useState } from 'react';
import { ChevronDown, ChevronUp, Users, X } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { GhostButton } from '@/components/common/GhostButton';
import { IconButton } from '@/components/common/IconButton';
import { FormField } from '@/components/common/FormField';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ContactPicker from './ContactPicker';
import { BandMemberRow } from './BandMemberRow';
import { useDatalistId } from '@/lib/hooks/useDatalistId';
import type { BookingBandChair, BookingBandMember, BookingBandMemberStatus, BookingLineup, BookingPackageSummary, Contact, LineupTemplate } from '@/types/api';

// Band members v1 (#879, ADR-0072 §2/§3/§5, #885; re-pointed by ADR-0081). Presentational: no
// fetch, no mutation — the host (BandSheet) wires every action via a callback. One row per member
// (segment chips for every chair they fill, via BandMemberRow), plus the unfilled-chair block from
// #884 — each vacant chair gets a ContactPicker to fill it.

const WHOLE_DAY = '__whole_day__';

/** Shared with BandCard/BandMemberRow — a chair's segment display name via its Lineup's segments,
 *  "Whole day" for a package-less Lineup (no links). At this slice a Lineup plays at most one
 *  segment (#987 makes many-to-many a UI reality), so the first link is the whole story. */
export function segmentLabel(chair: BookingBandChair, lineups: BookingLineup[], packages: BookingPackageSummary[]): string {
  const packageId = lineups.find((l) => l.id === chair.lineupId)?.packageIds[0];
  if (!packageId) return 'Whole day';
  return packages.find((p) => p.id === packageId)?.label ?? 'Whole day';
}

interface BandAtomProps {
  lineups: BookingLineup[];
  chairs: BookingBandChair[];
  members: BookingBandMember[];
  packages: BookingPackageSummary[];
  /** For chair-fill proximity ranking (#886, ADR-0072 §4) — missing coordinates degrade silently. */
  venue: Contact | null;
  /** Type-ahead suggestions for the "Add chair" role field — existing slot roles + declared
   *  instruments (#886, ADR-0072 §3). Soft matching, not a hard filter. */
  instrumentVocabulary: string[];
  lineupTemplates: LineupTemplate[];
  lineupTemplatesLoading: boolean;
  onApplyLineup: (lineupTemplateId: string, packageId: string | null) => void;
  isApplyingLineup: boolean;
  onAddChair: (role: string, packageId: string | null) => void;
  isAddingChair: boolean;
  onRemoveChair: (chairId: string) => void;
  removingChairId: string | null;
  onMoveChair: (chairId: string, direction: 'up' | 'down') => void;
  onAssignChair: (chairId: string, contactId: string | null) => void;
  assigningChairId: string | null;
  onChangeMemberStatus: (memberId: string, status: BookingBandMemberStatus) => void;
  changingStatusMemberId: string | null;
  onSaveMemberFee: (memberId: string, sessionFee: number | null) => void;
  savingFeeMemberId: string | null;
  onRemoveMember: (memberId: string) => void;
  removingMemberId: string | null;
}

function SegmentPicker({
  packages,
  value,
  onChange,
}: {
  packages: BookingPackageSummary[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <FormField label="Segment">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label="Segment">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={WHOLE_DAY}>Whole day</SelectItem>
          {packages.map((pkg) => (
            <SelectItem key={pkg.id} value={pkg.id}>{pkg.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

function ChairRow({
  chair,
  lineups,
  packages,
  venue,
  onRemove,
  isRemoving,
  onMove,
  canMoveUp,
  canMoveDown,
  onAssign,
  isAssigning,
}: {
  chair: BookingBandChair;
  lineups: BookingLineup[];
  packages: BookingPackageSummary[];
  venue: Contact | null;
  onRemove: () => void;
  isRemoving: boolean;
  onMove: (direction: 'up' | 'down') => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onAssign: (contactId: string | null) => void;
  isAssigning: boolean;
}) {
  return (
    <div className="py-2 border-b border-border last:border-b-0 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex flex-col">
          <IconButton label="Move up" onClick={() => onMove('up')} disabled={!canMoveUp} className="min-h-0 min-w-0 h-4">
            <ChevronUp size={14} />
          </IconButton>
          <IconButton label="Move down" onClick={() => onMove('down')} disabled={!canMoveDown} className="min-h-0 min-w-0 h-4">
            <ChevronDown size={14} />
          </IconButton>
        </div>
        <Badge variant="outline">{chair.role}</Badge>
        <span className="flex-1 text-sm text-muted">{segmentLabel(chair, lineups, packages)}</span>
        {chair.callTime && <span className="text-sm tabular-nums text-muted">{chair.callTime}</span>}
        <IconButton
          label="Remove chair"
          onClick={onRemove}
          disabled={isRemoving}
          className="hover:text-status-cancelled"
        >
          <X size={16} />
        </IconButton>
      </div>
      <ContactPicker
        value={null}
        onChange={onAssign}
        placeholder="Fill this chair..."
        label="member"
        chairRole={chair.role}
        venue={venue}
        disabled={isAssigning}
      />
    </div>
  );
}

export function BandAtom({
  lineups,
  chairs,
  members,
  packages,
  venue,
  instrumentVocabulary,
  lineupTemplates,
  lineupTemplatesLoading,
  onApplyLineup,
  isApplyingLineup,
  onAddChair,
  isAddingChair,
  onRemoveChair,
  removingChairId,
  onMoveChair,
  onAssignChair,
  assigningChairId,
  onChangeMemberStatus,
  changingStatusMemberId,
  onSaveMemberFee,
  savingFeeMemberId,
  onRemoveMember,
  removingMemberId,
}: BandAtomProps) {
  const [segment, setSegment] = useState<string>(WHOLE_DAY);
  const [addingRole, setAddingRole] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const roleDatalistId = useDatalistId();

  const targetPackageId = segment === WHOLE_DAY ? null : segment;
  const sortedChairs = [...chairs].sort((a, b) => a.order - b.order);
  const vacantChairs = sortedChairs.filter((c) => c.memberId == null);

  // Order is per-Lineup (ADR-0081) — moveChair swaps within the same Lineup only, so "adjacent"
  // is computed within each chair's own Lineup, not across the whole booking.
  function lineupChairsFor(chair: BookingBandChair): BookingBandChair[] {
    return sortedChairs.filter((c) => c.lineupId === chair.lineupId);
  }

  function submitAddChair() {
    if (!addingRole.trim()) return;
    onAddChair(addingRole.trim(), targetPackageId);
    setAddingRole('');
    setAddOpen(false);
  }

  return (
    <div className="space-y-4">
      {packages.length > 0 && <SegmentPicker packages={packages} value={segment} onChange={setSegment} />}

      {lineupTemplates.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Apply a lineup</p>
          <div className="flex flex-wrap gap-2">
            {lineupTemplates.map((lineup) => (
              <button
                key={lineup.id}
                type="button"
                disabled={isApplyingLineup}
                onClick={() => onApplyLineup(lineup.id, targetPackageId)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm transition-colors hover:border-primary disabled:opacity-50"
              >
                {lineup.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {lineupTemplatesLoading && <p className="text-sm text-muted">Loading lineups…</p>}

      {members.length === 0 && vacantChairs.length === 0 && !addOpen && (
        <EmptyState
          icon={<Users size={24} />}
          heading="No band yet"
          description="Apply a lineup, or add chairs one at a time."
          action={
            <GhostButton variant="primary" size="xs" onClick={() => setAddOpen(true)}>
              Add a chair
            </GhostButton>
          }
        />
      )}

      {members.length > 0 && (
        <Card title="Band">
          <div>
            {members.map((member) => (
              <BandMemberRow
                key={member.id}
                member={member}
                chairs={sortedChairs.filter((c) => c.memberId === member.id)}
                lineups={lineups}
                packages={packages}
                onUnassignChair={(chairId) => onAssignChair(chairId, null)}
                onChangeStatus={(status) => onChangeMemberStatus(member.id, status)}
                isChangingStatus={changingStatusMemberId === member.id}
                onSaveFee={(fee) => onSaveMemberFee(member.id, fee)}
                isSavingFee={savingFeeMemberId === member.id}
                onRemove={() => onRemoveMember(member.id)}
                isRemoving={removingMemberId === member.id}
              />
            ))}
          </div>
        </Card>
      )}

      {vacantChairs.length > 0 && (
        <Card title="Chairs to fill">
          <div>
            {vacantChairs.map((chair) => {
              // Position within the chair's own Lineup (not just among vacant chairs, and not
              // the whole booking) — moveChair swaps order with whichever chair is adjacent
              // *in the same Lineup*, filled or not (ADR-0081: order is per-Lineup).
              const lineupChairs = lineupChairsFor(chair);
              const indexInLineup = lineupChairs.indexOf(chair);
              return (
                <ChairRow
                  key={chair.id}
                  chair={chair}
                  lineups={lineups}
                  packages={packages}
                  venue={venue}
                  onRemove={() => onRemoveChair(chair.id)}
                  isRemoving={removingChairId === chair.id}
                  onMove={(direction) => onMoveChair(chair.id, direction)}
                  canMoveUp={indexInLineup > 0}
                  canMoveDown={indexInLineup < lineupChairs.length - 1}
                  onAssign={(contactId) => onAssignChair(chair.id, contactId)}
                  isAssigning={assigningChairId === chair.id}
                />
              );
            })}
          </div>
        </Card>
      )}

      {(members.length > 0 || vacantChairs.length > 0) && !addOpen && (
        <GhostButton variant="primary" size="xs" onClick={() => setAddOpen(true)}>
          + Add chair
        </GhostButton>
      )}

      {addOpen && (
        <div className="flex items-end gap-2">
          <FormField label="Role" className="flex-1">
            <Input
              value={addingRole}
              onChange={(e) => setAddingRole(e.target.value)}
              placeholder="e.g. Saxophone"
              list={roleDatalistId}
              autoFocus
            />
            <datalist id={roleDatalistId}>
              {instrumentVocabulary.map((role) => (
                <option key={role} value={role} />
              ))}
            </datalist>
          </FormField>
          <GhostButton
            variant="primary"
            size="sm"
            onClick={submitAddChair}
            disabled={!addingRole.trim() || isAddingChair}
            className="mb-0.5"
          >
            {isAddingChair ? 'Adding…' : 'Add'}
          </GhostButton>
        </div>
      )}
    </div>
  );
}
