import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// PRD #511 Module E — the commit checkpoint (slice #525). Setup is one continuous flow
// from the user's point of view; the create-vs-edit distinction is hidden behind this
// single legible moment. The lean creation form ends at the atomic POST (ADR-0047); the
// booking now exists (a clear "it's real" signal), and the musician chooses to Finish
// (exit as-is — the common enquiry path) or Continue setup (roll straight into the
// Builder one-pager, now editing a saved booking rather than a discardable draft).

interface CreatedCheckpointProps {
  /** The created booking's display title, echoed back as the "now real" confirmation. */
  title: string;
  onFinish: () => void;
  onContinue: () => void;
}

export function CreatedCheckpoint({ title, onFinish, onContinue }: CreatedCheckpointProps) {
  return (
    <div className="max-w-md">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-status-confirmed/12 text-status-confirmed">
        <CheckCircle2 size={28} />
      </div>
      <h1 className="font-display text-2xl font-semibold text-foreground">Booking created</h1>
      <p className="mt-2 text-base text-muted">
        <span className="font-medium text-foreground">{title}</span> is saved. Keep going to set up
        the itinerary, day details and music form — or finish here and come back any time.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button onClick={onContinue}>Continue setup</Button>
        <Button variant="outline" onClick={onFinish}>Finish</Button>
      </div>
    </div>
  );
}
