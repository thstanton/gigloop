import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: React.ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ label, children, className, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        className={cn('min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-muted hover:text-foreground transition-colors disabled:opacity-50', className)}
        {...props}
      >
        {children}
      </button>
    );
  },
);
