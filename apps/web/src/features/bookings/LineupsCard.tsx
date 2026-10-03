import { Plus } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { GhostButton } from '@/components/common/GhostButton';
import { RowActions } from '@/components/common/RowActions';
import { cn } from '@/lib/utils';
import { lineupName, partCountLine, partsOf, playsLine } from './bandParts';
import type { BookingBandChair, BookingLineup, BookingPackageSummary } from '@/types/api';

// #983's resolution, card 1 of 3. The **band** shape — a named row, used for a band and nowhere
// else. Name at 16/600, what it plays, its part count, and a `⋯` for band-level actions.
//
// The card stopped being a caption and became an object list: each band carries both `Plays …` and
// `N parts · M still to fill`, so there is a reason to look at it. Absent entirely when the booking
// has no bands — the empty case is BandAtom's EmptyState, not an empty card.

interface LineupsCardProps {
  lineups: BookingLineup[];
  chairs: BookingBandChair[];
  packages: BookingPackageSummary[];
  onEditSegments: (lineupId: string) => void;
  onRemoveLineup: (lineupId: string) => void;
  removingLineupId: string | null;
  onAddLineup: () => void;
}

export function LineupsCard({
  lineups,
  chairs,
  packages,
  onEditSegments,
  onRemoveLineup,
  removingLineupId,
  onAddLineup,
}: LineupsCardProps) {
  return (
    <Card title="Lineups">
      <div>
        {lineups.map((lineup) => {
          const name = lineupName(lineup, chairs);
          const plays = playsLine(lineup, packages);
          return (
            <div
              key={lineup.id}
              className="flex items-start justify-between gap-2 py-3 border-b border-border last:border-b-0"
            >
              <div className="min-w-0">
                <p className="text-base font-semibold text-foreground truncate">{name}</p>
                <p className={cn('text-sm', plays.warning ? 'text-status-cancelled' : 'text-muted')}>
                  {plays.text}
                </p>
                <p className="text-sm text-muted">{partCountLine(partsOf(lineup.id, chairs))}</p>
              </div>
              <RowActions
                label={name}
                actions={[
                  { label: 'What they play…', onClick: () => onEditSegments(lineup.id) },
                  {
                    label: `Remove ${name} from this booking`,
                    variant: 'destructive',
                    isPending: removingLineupId === lineup.id,
                    confirmation: {
                      title: `Remove ${name}?`,
                      description:
                        'Their parts go with them. Anyone playing only in this band comes off the gig; ' +
                        'anyone who also plays in another band keeps that part, their invitation and their confirmation.',
                    },
                    onClick: () => onRemoveLineup(lineup.id),
                  },
                ]}
              />
            </div>
          );
        })}
      </div>
      <div className="pt-3">
        <GhostButton variant="primary" icon={<Plus size={14} />} onClick={onAddLineup}>
          Add a lineup
        </GhostButton>
      </div>
    </Card>
  );
}
