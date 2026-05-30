import { cn } from '@/lib/utils';

interface StatusPillProps {
  label: string;
  bg: string;
  text: string;
  border: string;
  className?: string;
}

export function StatusPill({ label, bg, text, border, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center border-l-[3px] pl-2 pr-2.5 py-0.5 text-xs font-medium',
        bg,
        text,
        border,
        className,
      )}
    >
      {label}
    </span>
  );
}
