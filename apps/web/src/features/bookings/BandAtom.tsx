import { useState } from 'react';
import { Users } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { GhostButton } from '@/components/common/GhostButton';
import { AddLineupDialog } from './AddLineupDialog';
import { LineupSegmentsDialog } from './LineupSegmentsDialog';
import { LineupsCard } from './LineupsCard';
import { AddPartFooter, PartsToFillCard } from './PartsToFillCard';
import { PlayersCard } from './PlayersCard';
import type {
  BookingBandChair,
  BookingBandMember,
  BookingBandMemberStatus,
  BookingLineup,
  BookingPackageSummary,
  Contact,
  LineupTemplate,
} from '@/types/api';

// Band members v1 (#879, ADR-0072 §2/§3/§5, #885), re-pointed by ADR-0081 and rebuilt for #987 on
// #983's resolved design. Presentational: no fetch, no mutation — the host (BandSheet) wires every
// action via a callback.
//
// **Three cards, one shape per object** (#983): a band is a named row (Lineups), a part is a rail
// row (under a player, and in Parts to fill — identical markup in both), a player is a full-width
// heading (Players). No shape is reused for another object; the rounded badge that previously meant
// both "a chair" and "You" is gone.
//
// The `Whole day` sentinel is gone from the code, not merely hidden (#987 AC 2). A band linked to
// every segment plays the whole day and one on a package-less booking links to none — the same
// rule, expressed as an empty `packageIds`, with the booking saying which reading applies
// (`playsLine` in bandParts.ts).

interface BandAtomProps {
  lineups: BookingLineup[];
  chairs: BookingBandChair[];
  members: BookingBandMember[];
  packages: BookingPackageSummary[];
  /** For part-fill proximity ranking (#886, ADR-0072 §4) — missing coordinates degrade silently. */
  venue: Contact | null;
  /** Type-ahead suggestions for the "Add a part" role field — existing roles + declared instruments. */
  instrumentVocabulary: string[];
  lineupTemplates: LineupTemplate[];
  lineupTemplatesLoading: boolean;
  onApplyLineup: (lineupTemplateId: string, packageIds: string[]) => void;
  isApplyingLineup: boolean;
  onSetLineupSegments: (lineupId: string, packageIds: string[]) => void;
  isSettingLineupSegments: boolean;
  onRemoveLineup: (lineupId: string) => void;
  removingLineupId: string | null;
  onAddChair: (role: string, lineupId: string | null) => void;
  isAddingChair: boolean;
  onRemoveChair: (chairId: string) => void;
  removingChairId: string | null;
  onAssignChair: (chairId: string, contactId: string | null) => void;
  assigningChairId: string | null;
  onChangeMemberStatus: (memberId: string, status: BookingBandMemberStatus) => void;
  changingStatusMemberId: string | null;
  onSaveMemberFee: (memberId: string, sessionFee: number | null) => void;
  savingFeeMemberId: string | null;
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
  onSetLineupSegments,
  isSettingLineupSegments,
  onRemoveLineup,
  removingLineupId,
  onAddChair,
  isAddingChair,
  onRemoveChair,
  removingChairId,
  onAssignChair,
  assigningChairId,
  onChangeMemberStatus,
  changingStatusMemberId,
  onSaveMemberFee,
  savingFeeMemberId,
}: BandAtomProps) {
  const [addingLineup, setAddingLineup] = useState(false);
  const [editingSegmentsFor, setEditingSegmentsFor] = useState<string | null>(null);

  const editingLineup = lineups.find((l) => l.id === editingSegmentsFor) ?? null;
  const vacantChairs = chairs
    .filter((c) => c.memberId === null)
    .sort((a, b) => a.order - b.order);

  // #983's first ruling: there is no "Decide later" here. Opening this sheet *is* later, so the
  // empty state offers the two writes and nothing that writes nothing.
  if (lineups.length === 0 && chairs.length === 0) {
    return (
      <>
        <EmptyState
          icon={<Users size={32} />}
          heading="No band yet"
          description="Add one of your saved lineups, or add parts one at a time."
          action={
            <div className="flex flex-col items-center gap-2">
              <GhostButton variant="primary" onClick={() => setAddingLineup(true)}>Add a lineup</GhostButton>
              <AddPartFooter
                lineups={lineups}
                instrumentVocabulary={instrumentVocabulary}
                onAddPart={onAddChair}
                isAddingPart={isAddingChair}
              />
            </div>
          }
        />
        {addingLineup && (
          <AddLineupDialog
            lineupTemplates={lineupTemplates}
            lineupTemplatesLoading={lineupTemplatesLoading}
            packages={packages}
            lineups={lineups}
            chairs={chairs}
            members={members}
            onApply={(id, packageIds) => { onApplyLineup(id, packageIds); setAddingLineup(false); }}
            isApplying={isApplyingLineup}
            onClose={() => setAddingLineup(false)}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {lineups.length > 0 && (
        <LineupsCard
          lineups={lineups}
          chairs={chairs}
          packages={packages}
          onEditSegments={setEditingSegmentsFor}
          onRemoveLineup={onRemoveLineup}
          removingLineupId={removingLineupId}
          onAddLineup={() => setAddingLineup(true)}
        />
      )}

      <PlayersCard
        members={members}
        chairs={chairs}
        lineups={lineups}
        hasPackages={packages.length > 0}
        onUnassignChair={(chairId) => onAssignChair(chairId, null)}
        onChangeStatus={onChangeMemberStatus}
        changingStatusMemberId={changingStatusMemberId}
        onSaveFee={onSaveMemberFee}
        savingFeeMemberId={savingFeeMemberId}
      />

      <PartsToFillCard
        vacantChairs={vacantChairs}
        lineups={lineups}
        hasPackages={packages.length > 0}
        venue={venue}
        instrumentVocabulary={instrumentVocabulary}
        onAssignChair={onAssignChair}
        assigningChairId={assigningChairId}
        onAddPart={onAddChair}
        isAddingPart={isAddingChair}
        onRemovePart={onRemoveChair}
        removingPartId={removingChairId}
      />

      {addingLineup && (
        <AddLineupDialog
          lineupTemplates={lineupTemplates}
          lineupTemplatesLoading={lineupTemplatesLoading}
          packages={packages}
          lineups={lineups}
          chairs={chairs}
          members={members}
          onApply={(id, packageIds) => { onApplyLineup(id, packageIds); setAddingLineup(false); }}
          isApplying={isApplyingLineup}
          onClose={() => setAddingLineup(false)}
        />
      )}

      {editingLineup && (
        <LineupSegmentsDialog
          lineup={editingLineup}
          chairs={chairs}
          members={members}
          packages={packages}
          onSave={(packageIds) => { onSetLineupSegments(editingLineup.id, packageIds); setEditingSegmentsFor(null); }}
          isSaving={isSettingLineupSegments}
          onClose={() => setEditingSegmentsFor(null)}
        />
      )}
    </div>
  );
}
