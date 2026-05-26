import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { cn } from '@/lib/utils';

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function parseYMD(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function toYMD(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatDisplay(ymd: string): string {
  const d = parseYMD(ymd);
  if (!d) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function todayYMD(): string {
  return toYMD(new Date());
}

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  disabled,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const today = todayYMD();

  const selected = parseYMD(value);
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? new Date().getMonth());
  const [focusedYMD, setFocusedYMD] = useState<string>(value || today);

  useEffect(() => {
    if (!open) return;
    const d = parseYMD(value) ?? new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setFocusedYMD(value || today);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Calendar grid — Monday-first
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => toYMD(new Date(viewYear, viewMonth, i + 1))),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function selectDay(ymd: string) {
    onChange(ymd);
    setOpen(false);
  }

  function moveFocus(delta: number) {
    const base = parseYMD(focusedYMD) ?? new Date();
    base.setDate(base.getDate() + delta);
    const next = toYMD(base);
    setFocusedYMD(next);
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowLeft':  e.preventDefault(); moveFocus(-1); break;
      case 'ArrowRight': e.preventDefault(); moveFocus(1); break;
      case 'ArrowUp':    e.preventDefault(); moveFocus(-7); break;
      case 'ArrowDown':  e.preventDefault(); moveFocus(7); break;
      case 'Enter':
        e.preventDefault();
        if (focusedYMD) selectDay(focusedYMD);
        break;
      case 'Escape':
        setOpen(false);
        break;
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border',
            'bg-background px-3 py-1 text-sm shadow-sm',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'hover:border-border-strong transition-colors',
            !value && 'text-muted',
            className,
          )}
        >
          <span>{value ? formatDisplay(value) : placeholder}</span>
          <CalendarDays size={14} className="text-muted flex-shrink-0" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-auto p-0 overflow-hidden"
        align="start"
        onKeyDown={handleKeyDown}
      >
        {/* Month navigation */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1 rounded hover:bg-accent transition-colors text-foreground"
            aria-label="Previous month"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="text-sm font-medium text-foreground select-none">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1 rounded hover:bg-accent transition-colors text-foreground"
            aria-label="Next month"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 px-3 pt-3">
          {DAY_LABELS.map((d) => (
            <span
              key={d}
              className="h-8 w-8 flex items-center justify-center text-xs font-medium text-muted select-none"
            >
              {d}
            </span>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 px-3 pb-3 gap-y-0.5">
          {cells.map((ymd, i) => {
            if (!ymd) return <span key={`empty-${i}`} className="h-8 w-8" />;

            const isSelected = ymd === value;
            const isToday = ymd === today;
            const isFocused = ymd === focusedYMD;

            return (
              <button
                key={ymd}
                type="button"
                onClick={() => selectDay(ymd)}
                onMouseEnter={() => setFocusedYMD(ymd)}
                aria-label={parseYMD(ymd)?.toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
                aria-pressed={isSelected}
                className={cn(
                  'relative h-8 w-8 flex items-center justify-center rounded-md text-sm select-none transition-colors',
                  isSelected
                    ? 'bg-primary text-primary-foreground font-medium'
                    : isToday
                    ? 'text-primary font-medium hover:bg-accent'
                    : 'text-foreground hover:bg-accent',
                  isFocused && !isSelected && 'ring-1 ring-ring ring-inset',
                )}
              >
                {parseYMD(ymd)!.getDate()}
                {isToday && !isSelected && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-1 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
