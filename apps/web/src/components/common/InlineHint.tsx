import { ArrowRight, Sparkle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface InlineHintProps {
  /** Optional muted lead text shown before the action link. */
  children?: React.ReactNode;
  /** Text of the action link (e.g. "Add your home address to see travel time"). */
  actionLabel: string;
  /** Internal route the action links to. */
  href: string;
  /**
   * Leading icon. Defaults to a Sparkle — the shared visual marker that
   * identifies an inline hint. Pass another Lucide icon to override, or `null`
   * to omit it.
   */
  icon?: React.ReactNode;
  className?: string;
}

/**
 * Actionable in-context prompt: short muted guidance + a link that routes the
 * musician to where they can fix a setup gap. The shared "Add X →" surface —
 * distinct from passive helper text (it always carries an action). First used
 * by the venue map widget's travel-time prompt; reused by the dashboard tips
 * widget.
 */
export function InlineHint({
  children,
  actionLabel,
  href,
  icon = <Sparkle size={14} />,
  className,
}: InlineHintProps) {
  return (
    <div className={cn('flex items-center gap-1.5 text-sm text-muted', className)}>
      {icon && <span className="flex-shrink-0 text-primary">{icon}</span>}
      <span>
        {children && <span>{children} </span>}
        <Link
          to={href}
          className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
        >
          {actionLabel}
          <ArrowRight size={14} aria-hidden className="flex-shrink-0" />
        </Link>
      </span>
    </div>
  );
}
