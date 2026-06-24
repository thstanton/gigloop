import { useState } from 'react';
import { Compass, HelpCircle, X } from 'lucide-react';
import { GhostButton } from '@/components/common/GhostButton';
import { IconButton } from '@/components/common/IconButton';

interface BookingConceptCardProps {
  /** Whether the card has been dismissed (persisted). */
  isDismissed: boolean;
  /** Persist the dismissal. */
  onDismiss: () => void;
}

/**
 * One-time teaching card: a booking is a project the musician drives. Explains
 * that lifecycle stages reflect their own readiness judgement (advanced
 * manually) and the checklist is the work that moves it forward.
 *
 * Owns only local view-state: when dismissed it collapses to a "How this works"
 * recall trigger that re-shows the card without clearing the saved dismissal.
 * The persisted dismissal lives in the container via useDismissibleHint.
 */
export function BookingConceptCard({ isDismissed, onDismiss }: BookingConceptCardProps) {
  const [recalled, setRecalled] = useState(false);
  const showCard = !isDismissed || recalled;

  if (!showCard) {
    return (
      <GhostButton
        variant="muted"
        size="xs"
        icon={<HelpCircle size={12} />}
        onClick={() => setRecalled(true)}
        className="mb-3"
      >
        How this works
      </GhostButton>
    );
  }

  return (
    <div className="bg-accent/40 border border-border rounded-lg p-4 mb-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-base font-medium text-foreground">
          <Compass size={16} className="text-primary flex-shrink-0" />
          How this booking works
        </h3>
        <IconButton
          label="Dismiss"
          className="-mr-2 -mt-2"
          onClick={() => {
            setRecalled(false);
            onDismiss();
          }}
        >
          <X size={16} />
        </IconButton>
      </div>
      <div className="mt-1 space-y-2 text-sm text-muted">
        <p>
          This booking is a project you drive. The <span className="font-medium text-foreground">stage</span> reflects
          your own read on how ready it is — it never advances on its own; you move it on when you’re ready.
        </p>
        <p>
          The <span className="font-medium text-foreground">checklist</span> below is the work that gets you there.
          Tick things off as you go.
        </p>
      </div>
    </div>
  );
}
