import { X } from 'lucide-react';
import { InlineHint } from '@/components/common/InlineHint';
import { IconButton } from '@/components/common/IconButton';
import type { TipDisplay } from './tipEngine';

interface TipsWidgetProps {
  /** The single tip to show, or null to render nothing. */
  tip: TipDisplay | null;
  /** Dismiss the shown tip. */
  onDismiss: () => void;
}

/**
 * Dashboard tips widget: shows one setup pointer at a time as an InlineHint
 * (with its shared sparkle marker), plus a dismiss control. Renders nothing when
 * no tip is eligible, so it fades away as the musician settles in. Mounted
 * full-width above the dashboard grid.
 */
export function TipsWidget({ tip, onDismiss }: TipsWidgetProps) {
  if (!tip) return null;

  return (
    <div className="mb-8 flex items-center justify-between gap-2 rounded-lg border border-border bg-accent/40 px-4 py-3">
      <InlineHint actionLabel={tip.text} href={tip.href} />
      <IconButton label="Dismiss tip" className="-mr-2 flex-shrink-0" onClick={onDismiss}>
        <X size={16} />
      </IconButton>
    </div>
  );
}
