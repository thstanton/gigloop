import { cn } from '@/lib/utils';

interface CardProps {
  title?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function Card({ title, action, className, children }: CardProps) {
  return (
    <div className={cn('bg-background border border-border rounded-lg p-4', className)}>
      {title && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-muted uppercase tracking-wide">{title}</p>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
