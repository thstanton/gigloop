import { cn } from '@/lib/utils';

interface TogglePillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active: boolean;
}

export function TogglePill({ active, children, className, ...props }: Readonly<TogglePillProps>) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-colors',
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-background text-foreground border-border hover:border-primary',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
