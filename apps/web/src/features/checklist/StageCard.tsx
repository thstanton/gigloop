import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StageCardProps {
  /** Section heading — a stage label ("Provisional") or a non-stage group ("Anytime"). */
  label: string;
  /** The line beside the label — a stage description, or what the group holds. */
  description: string;
  /** The lifecycle-colour accent bar class (`STATUS_ACCENT_BG[stage]`). Omit for a neutral group. */
  accentClass?: string;
  /** The rows (or an empty-state) — owned by the consumer, since surfaces differ. */
  children: ReactNode;
}

/**
 * The stage-card shell shared by the onboarding "How GigLoop runs your bookings" step and the
 * Settings checklist configurator (#620): a bordered card with an accent-bar header. It renders
 * chrome only — the row content and any empty-state live in the consumer, because the two surfaces
 * differ (onboarding shows "Nothing to track…"; Settings shows an add affordance).
 */
export function StageCard({ label, description, accentClass, children }: StageCardProps) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border bg-muted/30">
        <p className="text-sm text-foreground/70">
          <span className="inline-flex items-center gap-2 align-baseline mr-1">
            <span className={cn('w-[3px] h-3 rounded-full', accentClass ?? 'bg-border')} aria-hidden />
            <span className="font-semibold text-foreground">{label} ·</span>
          </span>
          {description}
        </p>
      </div>
      {children}
    </div>
  );
}
