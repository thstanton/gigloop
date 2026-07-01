import { Eye, EyeOff } from 'lucide-react';
import { PORTAL_VISIBILITY_REASON_COPY } from '@/lib/constants';
import type { PortalVisibilityVerdict } from '@/types/api';

export type PortalVisibilityProps = PortalVisibilityVerdict;

/**
 * The admin Portal-visibility indicator (ADR-0054). A passive mirror of what the client can
 * currently see on the portal — it never changes visibility. Deliberately asymmetric: the
 * visible state is a prominent green badge ("your client is looking at this now"); the hidden
 * state is a subordinate muted hint naming the portal gate. Icon + coloured text only — no
 * chip/enclosure and no new palette hue (a chip would mimic the status pill and collapse the
 * two axes; the Eye/EyeOff icon is the axis differentiator).
 */
export function PortalVisibility({ visible, reason }: PortalVisibilityProps) {
  if (visible) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
        <Eye size={14} aria-hidden />
        Visible on Client Portal
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted">
      <EyeOff size={14} aria-hidden />
      {reason ? PORTAL_VISIBILITY_REASON_COPY[reason] : 'Not visible'}
    </span>
  );
}
