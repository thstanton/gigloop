import type { ReactNode } from 'react';
import { LabelValue } from '@/components/common/LabelValue';
import { cn } from '@/lib/utils';

// #983's resolution — the **part** shape, used for a part and nothing else. Role in a fixed narrow
// left column, then its call times — one per segment it is called to — (and its band, only when
// the booking has more than one), then one action. A filled part and an empty one are the SAME row: that is how the vacancy/member symmetry
// is answered — one component used twice, not two blocks made to resemble each other.
//
// This is LabelValue at a narrower column, not a copy of it. `cn` is twMerge, so the grid override
// below replaces the primitive's 140px base cleanly (BandMemberRow overrode the same component the
// same way before #987). 140px leaves too little room inside a card at 375px.
//
// Not SubLabel for the band name: that is a uppercase/tracked `<p>`, and this slot sits inside
// LabelValue's value `<span>`. Inline muted meta, not a heading.

interface PartRowProps {
  role: string;
  /**
   * One phrase per segment the part is called to — "18:00 Drinks Reception" — already worded by
   * `callTimeParts`, which owns the package-less bucket's two readings. A part called to two
   * segments carries two: showing only the earliest hid the second call entirely. Empty means no
   * segment the band plays has a timed set — absent, not zero.
   */
  callTimes: string[];
  /** The band's name — pass only when the booking has more than one (see `shouldNameBand`). */
  bandName?: string;
  /** One action: fill it, or empty it. */
  action?: ReactNode;
  /**
   * Whether this row draws LabelValue's own bottom border. Default `true` — successive rows under
   * a Player divide themselves. `PartsToFillCard` passes `false`: there, a vacant part's row and
   * its attached "fill this part" picker are one unit, so the divider belongs on the unit's own
   * wrapper, below the picker, not between the row and its own picker.
   */
  bordered?: boolean;
}

export function PartRow({ role, callTimes, bandName, action, bordered = true }: PartRowProps) {
  return (
    <LabelValue label={role} className={cn('grid-cols-[84px_1fr] gap-3 py-2', !bordered && 'border-b-0')}>
      {/* items-start, not items-center: the label has no flex wrapper of its own so it top-aligns
          by default — this row must match it, or the two drift apart the moment the value column
          runs to more than one line (which a part called to two segments always does). */}
      <span className="flex items-start gap-2">
        <span className="flex min-w-0 flex-1 flex-col gap-y-0.5">
          {/* One call per line, not a wrapped run: two calls are two separate facts about the day,
              and running them together on one line made the second read as a continuation of the
              first rather than a second time the player has to be somewhere. */}
          {callTimes.length === 0 ? (
            <span className="text-base text-foreground">No call time</span>
          ) : (
            // Keyed by position: two segments can legitimately share a label (a package rename is
            // free) and a start time, so the phrase itself is not a unique key.
            callTimes.map((call, i) => (
              <span key={i} className="text-base text-foreground">{call}</span>
            ))
          )}
          {bandName && <span className="text-sm text-muted">{bandName}</span>}
        </span>
        {action && <span className="flex items-center">{action}</span>}
      </span>
    </LabelValue>
  );
}
