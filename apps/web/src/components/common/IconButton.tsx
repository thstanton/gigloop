import { cn } from '@/lib/utils';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: React.ReactNode;
}

export function IconButton({ label, children, className, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn('text-muted hover:text-foreground transition-colors disabled:opacity-50', className)}
      {...props}
    >
      {children}
    </button>
  );
}
