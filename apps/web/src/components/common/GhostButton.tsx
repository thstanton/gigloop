import { cn } from '@/lib/utils';

interface GhostButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  variant?: 'muted' | 'primary';
  size?: 'sm' | 'xs';
}

export function GhostButton({
  icon,
  children,
  variant = 'muted',
  size = 'sm',
  className,
  ...props
}: GhostButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1 transition-colors disabled:opacity-50',
        size === 'xs' ? 'text-xs' : 'text-sm',
        variant === 'primary'
          ? 'text-primary hover:text-primary/80'
          : 'text-muted hover:text-foreground',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
