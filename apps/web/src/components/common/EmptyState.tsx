import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: React.ReactNode;
  heading: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, heading, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center text-center py-16 px-4', className)}>
      <div className="text-muted mb-3">{icon}</div>
      <h2 className="text-base font-medium text-foreground mb-1">{heading}</h2>
      {description && <p className="text-sm text-muted mb-4 max-w-sm">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}
