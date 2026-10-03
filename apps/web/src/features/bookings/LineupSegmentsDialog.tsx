import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { SegmentToggles } from './SegmentToggles';
import { joinSegments, lineupName, lineupSegmentLabels, partsOf } from './bandParts';
import type { BookingBandChair, BookingBandMember, BookingLineup, BookingPackageSummary } from '@/types/api';

// #987 journey ④ — "the drinks set is downgraded to a solo, late". `⋯ → What they play…`.
//
// The warning is the point of this dialog. Taking a segment away from a band is the one action here
// that a musician could reasonably fear, so it names exactly who is affected and states what
// survives — their remaining parts, their invitations and their confirmations all do, because the
// write touches links only and never chairs. Without that sentence the safe operation *looks* like
// the destructive one.

interface LineupSegmentsDialogProps {
  lineup: BookingLineup;
  chairs: BookingBandChair[];
  members: BookingBandMember[];
  packages: BookingPackageSummary[];
  onSave: (packageIds: string[]) => void;
  isSaving: boolean;
  onClose: () => void;
}

export function LineupSegmentsDialog({
  lineup,
  chairs,
  members,
  packages,
  onSave,
  isSaving,
  onClose,
}: LineupSegmentsDialogProps) {
  const [selected, setSelected] = useState<string[]>(lineup.packageIds);
  const name = lineupName(lineup, chairs);

  const removed = lineup.packageIds.filter((id) => !selected.includes(id));
  const removedLabels = packages.filter((p) => removed.includes(p.id)).map((p) => p.label);

  // Everyone holding a part in this band — they are who a segment change reaches.
  const parts = partsOf(lineup.id, chairs);
  const affected = members.filter((m) => parts.some((c) => c.memberId === m.id));
  const remainingLabels = packages
    .filter((p) => selected.includes(p.id))
    .map((p) => p.label);

  return (
    <ResponsiveDialog open onOpenChange={onClose}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>What {name} plays</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <ResponsiveDialogDescription>
          {lineup.packageIds.length
            ? `Currently plays ${joinSegments(lineupSegmentLabels(lineup, packages))}.`
            : 'This band has nothing to play yet.'}
        </ResponsiveDialogDescription>

        <div className="mt-3">
          <SegmentToggles
            packages={packages}
            selected={selected}
            onToggle={(id) =>
              setSelected((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))
            }
            disabled={isSaving}
          />
        </div>

        {removed.length > 0 && (
          <div className="mt-4 border-l-[3px] border-status-cancelled pl-3">
            <p className="text-base text-foreground">
              {name} will no longer play {joinSegments(removedLabels)}.
            </p>
            {affected.length > 0 && (
              <p className="text-sm text-muted mt-1">
                {affected.map((m) => m.contact.name).join(', ')}{' '}
                {affected.length === 1 ? 'keeps' : 'keep'}{' '}
                {remainingLabels.length
                  ? `their part in ${joinSegments(remainingLabels)}, along with their invitation and confirmation.`
                  : 'their parts, their invitations and their confirmations — this band just has nothing to play.'}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={() => onSave(selected)} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
