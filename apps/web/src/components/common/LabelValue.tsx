import { cn } from '@/lib/utils';

interface LabelValueProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export function LabelValue({ label, children, className }: LabelValueProps) {
  return (
    <div className={cn('py-3 grid grid-cols-[140px_1fr] gap-4 border-b border-border last:border-0', className)}>
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm text-foreground">{children}</span>
    </div>
  );
}
