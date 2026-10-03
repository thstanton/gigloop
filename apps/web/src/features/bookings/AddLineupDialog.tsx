import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/common/FormField';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { SegmentToggles } from './SegmentToggles';
import { joinSegments, lineupName, lineupsDisplacedBy, partsOf } from './bandParts';
import type {
  BookingBandChair,
  BookingBandMember,
  BookingLineup,
  BookingPackageSummary,
  LineupTemplate,
} from '@/types/api';

// `+ Add a lineup` on the Lineups card (#983). #987's payoff lives here: the musician picks ONE
// band and ticks the sets it plays, so a four-piece on the drinks and the reception is one choice
// producing four parts — not the same choice made twice producing eight.
//
// There is no "Decide later" (#983's first ruling): that is a create-time answer to a form about to
// write, and opening this sheet *is* later. On a booking with no packages there is nothing to tick,
// so the segment step is absent entirely and the band plays the whole gig.

interface AddLineupDialogProps {
  lineupTemplates: LineupTemplate[];
  lineupTemplatesLoading: boolean;
  packages: BookingPackageSummary[];
  /** Needed only to warn before this apply sweeps a band that already plays the chosen sets. */
  lineups: BookingLineup[];
  chairs: BookingBandChair[];
  members: BookingBandMember[];
  onApply: (lineupTemplateId: string, packageIds: string[]) => void;
  isApplying: boolean;
  onClose: () => void;
}

/**
 * Unlike journey ④, applying a lineup genuinely destroys: a band left playing nothing is swept, and
 * its parts, its people's seats and their confirmations go with it. So it says so first, naming who
 * is affected — the same shape LineupSegmentsDialog uses for the far safer operation.
 */
function DisplacementWarning({
  displaced,
  chairs,
  members,
  packages,
}: {
  displaced: BookingLineup[];
  chairs: BookingBandChair[];
  members: BookingBandMember[];
  packages: BookingPackageSummary[];
}) {
  const names = displaced.map((l) => lineupName(l, chairs));
  const losing = members.filter((m) =>
    displaced.some((l) => partsOf(l.id, chairs).some((c) => c.memberId === m.id)),
  );

  return (
    <div className="mt-4 border-l-[3px] border-status-cancelled pl-3">
      <p className="text-base text-foreground">
        This replaces {joinSegments(names)}
        {packages.length ? '' : ' on this booking'}.
      </p>
      {losing.length > 0 && (
        <p className="text-sm text-muted mt-1">
          {losing.map((m) => m.contact.name).join(', ')}{' '}
          {losing.length === 1 ? 'loses their part' : 'lose their parts'} and{' '}
          {losing.length === 1 ? 'its' : 'their'} confirmation. Take a set off that band instead
          (⋯ → What they play…) to keep them.
        </p>
      )}
    </div>
  );
}

/** The dialog's body — split from the shell so the two stay one readable thing each. */
function AddLineupBody({
  lineupTemplates,
  lineupTemplatesLoading,
  packages,
  lineups,
  chairs,
  members,
  onApply,
  isApplying,
  onClose,
}: AddLineupDialogProps) {
  const [templateId, setTemplateId] = useState<string>('');
  // Defaults to every set: the common case is one band playing the whole day, and #987 exists so
  // that is one choice rather than one per set. It also means the default selection can displace an
  // existing band, which is what `displaced` below is for.
  const [selected, setSelected] = useState<string[]>(packages.map((p) => p.id));

  const displaced = lineupsDisplacedBy(lineups, packages, packages.length ? selected : []);

  if (lineupTemplatesLoading) {
    return <ResponsiveDialogDescription>Loading your lineups…</ResponsiveDialogDescription>;
  }

  if (lineupTemplates.length === 0) {
    return (
      <ResponsiveDialogDescription>
        You have no saved lineups yet. Add parts one at a time instead, or create a lineup in Settings.
      </ResponsiveDialogDescription>
    );
  }

  return (
    <>
      <FormField label="Lineup">
        <Select value={templateId} onValueChange={setTemplateId}>
          <SelectTrigger aria-label="Lineup">
            <SelectValue placeholder="Choose a lineup" />
          </SelectTrigger>
          <SelectContent>
            {lineupTemplates.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      {packages.length > 0 && (
        <div className="mt-4">
          <p className="text-base text-foreground mb-2">What do they play?</p>
          <SegmentToggles
            packages={packages}
            selected={selected}
            onToggle={(id) =>
              setSelected((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))
            }
            disabled={isApplying}
          />
        </div>
      )}

      {displaced.length > 0 && <DisplacementWarning displaced={displaced} chairs={chairs} members={members} packages={packages} />}

      <div className="flex gap-2 justify-end mt-4">
        <Button variant="outline" onClick={onClose} disabled={isApplying}>Cancel</Button>
        <Button
          onClick={() => onApply(templateId, packages.length ? selected : [])}
          disabled={!templateId || isApplying}
        >
          {isApplying ? 'Adding…' : 'Add lineup'}
        </Button>
      </div>
    </>
  );
}

export function AddLineupDialog({
  lineupTemplates,
  lineupTemplatesLoading,
  packages,
  lineups,
  chairs,
  members,
  onApply,
  isApplying,
  onClose,
}: AddLineupDialogProps) {
  return (
    <ResponsiveDialog open onOpenChange={onClose}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Add a lineup</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <AddLineupBody
          lineupTemplates={lineupTemplates}
          lineupTemplatesLoading={lineupTemplatesLoading}
          packages={packages}
          lineups={lineups}
          chairs={chairs}
          members={members}
          onApply={onApply}
          isApplying={isApplying}
          onClose={onClose}
        />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
