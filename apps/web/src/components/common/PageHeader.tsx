import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subheading?: string;
  backHref?: string;
  backLabel?: string;
  onBack?: () => void;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subheading, backHref, backLabel = 'Back', onBack, action, className }: PageHeaderProps) {
  const backLinkClass = 'inline-flex items-center gap-1 text-sm text-foreground/75 hover:text-foreground transition-colors';

  return (
    <div className={className}>
      {(backHref || onBack) && (
        <div className="mb-6">
          {backHref ? (
            <Link to={backHref} className={backLinkClass}>
              <ChevronLeft size={14} />
              {backLabel}
            </Link>
          ) : (
            <button type="button" onClick={onBack} className={backLinkClass}>
              <ChevronLeft size={14} />
              {backLabel}
            </button>
          )}
        </div>
      )}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">{title}</h1>
          {subheading && <p className="text-base text-muted mt-1">{subheading}</p>}
        </div>
        {action && <div className="flex items-center gap-2 flex-shrink-0">{action}</div>}
      </div>
    </div>
  );
}
