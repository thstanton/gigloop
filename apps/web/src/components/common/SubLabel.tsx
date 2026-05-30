import { cn } from '@/lib/utils';

interface SubLabelProps {
  children: React.ReactNode;
  className?: string;
}

export function SubLabel({ children, className }: SubLabelProps) {
  return (
    <p className={cn('text-xs font-medium text-muted uppercase tracking-wide', className)}>
      {children}
    </p>
  );
}
