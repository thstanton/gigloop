import { ArrowRight, Sparkle, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { IconButton } from '@/components/common/IconButton';
import { cn } from '@/lib/utils';

interface InlineHintProps {
  /** Optional muted lead text shown before the action. */
  children?: React.ReactNode;
  /** Text of the action (e.g. "Add your home address to see travel time"). */
  actionLabel: string;
  /**
   * Internal route the action links to (renders a Link). Provide exactly one of
   * `href` or `onClick` — `href` wins if both are given.
   */
  href?: string;
  /**
   * Operation the action performs (renders a button). Use this instead of `href`
   * when the action mutates rather than navigates, so the hint triggers it
   * directly rather than laundering it through a route.
   */
  onClick?: () => void;
  /** Disables the `onClick` action (e.g. while its mutation is in flight). Ignored for `href`. */
  disabled?: boolean;
  /**
   * Leading icon. Defaults to a Sparkle — the shared visual marker that
   * identifies an inline hint. Pass another Lucide icon to override, or `null`
   * to omit it.
   */
  icon?: React.ReactNode;
  /**
   * When provided, renders a trailing dismiss "X" that calls this handler.
   * Persisting the dismissal is the caller's job (see useDismissibleHint).
   */
  onDismiss?: () => void;
  className?: string;
}

/**
 * Actionable in-context prompt: short muted guidance + an action that fixes a
 * setup gap. The shared "Add X →" surface — distinct from passive helper text
 * (it always carries an action). First used by the venue map widget's
 * travel-time prompt; reused by the dashboard tips widget.
 */
export function InlineHint({
  children,
  actionLabel,
  href,
  onClick,
  disabled,
  icon = <Sparkle size={14} />,
  onDismiss,
  className,
}: InlineHintProps) {
  const actionClass =
    'inline-flex items-center gap-0.5 font-medium text-primary hover:underline';
  const actionInner = (
    <>
      {actionLabel}
      <ArrowRight size={14} aria-hidden className="flex-shrink-0" />
    </>
  );

  return (
    <div className={cn('flex items-center gap-1.5 text-sm text-muted', className)}>
      {icon && <span className="flex-shrink-0 text-primary">{icon}</span>}
      <span>
        {children && <span>{children} </span>}
        {href != null ? (
          <Link to={href} className={actionClass}>
            {actionInner}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(actionClass, 'text-left disabled:opacity-60')}
          >
            {actionInner}
          </button>
        )}
      </span>
      {onDismiss && (
        <IconButton label="Dismiss" onClick={onDismiss} className="-my-2 ml-auto flex-shrink-0">
          <X size={14} />
        </IconButton>
      )}
    </div>
  );
}
