import { Button } from '@/components/ui/button';
import type { BookingBandMemberStatus } from '@/types/api';

export type BandResponseValue = Extract<BookingBandMemberStatus, 'CONFIRMED' | 'DECLINED'>;

interface BandResponseBarProps {
  status: BookingBandMemberStatus;
  onConfirm: () => void;
  onDecline: () => void;
  pendingResponse: BandResponseValue | null;
  /** #980 — admin preview mode (`?preview=admin`). Buttons stay visible (so the organiser sees the
   *  real bar a dep would get) but disabled, matching the client portal's contract-sign / music-form
   *  preview convention (PortalContractPage.tsx, PortalMusicPage.tsx). */
  isPreview?: boolean;
}

// The dep's one-shot answer (#892). Sticky at the bottom of the viewport so it's reachable
// without scrolling at 375px (CLAUDE.md's mobile-first rule), and it never disappears once
// answered — it flips to a static readout instead, because there is no self-serve undo (a
// reversal is organiser-only, from the Band sheet). `fixed` (not `sticky`) so it stays pinned
// regardless of scroll position; `BandGigSheet` reserves matching bottom space so it never
// covers content.
const BAR_CLASSES = 'fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background px-4 py-3';

export function BandResponseBar({ status, onConfirm, onDecline, pendingResponse, isPreview = false }: BandResponseBarProps) {
  const isPending = pendingResponse !== null;

  if (status === 'CONFIRMED' || status === 'DECLINED') {
    return (
      <div className={BAR_CLASSES}>
        <p className="text-base text-foreground">
          {status === 'CONFIRMED'
            ? "You've confirmed you're playing this gig."
            : "You've declined this gig."}
        </p>
      </div>
    );
  }

  // A disabled native <button> never fires onClick, so isPreview only needs to gate `disabled` —
  // onConfirm/onDecline stay wired unconditionally.
  const disabled = isPending || isPreview;

  return (
    <div className={BAR_CLASSES}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-base text-foreground">Are you in for this gig?</p>
        <div className="flex gap-2">
          <Button variant="destructiveOutline" disabled={disabled} onClick={onDecline}>
            {pendingResponse === 'DECLINED' ? 'Declining…' : 'Decline'}
          </Button>
          <Button disabled={disabled} onClick={onConfirm}>
            {pendingResponse === 'CONFIRMED' ? 'Confirming…' : 'Confirm'}
          </Button>
        </div>
      </div>
      {isPreview && <p className="mt-2 text-sm text-center text-muted sm:text-right">Preview only — response disabled</p>}
    </div>
  );
}
