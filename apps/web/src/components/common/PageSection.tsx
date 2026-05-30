import { cn } from '@/lib/utils';

interface PageSectionProps {
  title: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
}

export function PageSection({ title, description, className, children }: PageSectionProps) {
  return (
    <div className={cn('mb-6', className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {children}
      </div>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
    </div>
  );
}
