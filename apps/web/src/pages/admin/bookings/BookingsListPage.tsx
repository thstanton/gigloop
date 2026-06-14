import { useRef, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DatePicker } from '@/components/ui/date-picker';
import BookingsTable from '@/features/bookings/BookingsTable';
import { useBookings } from '@/lib/hooks/useBookings';
import { resolveListScope, type ListTab } from '@/lib/bookingScope';
import { EVENT_TYPE_LABELS } from '@/lib/constants';
import type { BookingStatus, EventType } from '@/types/api';
import { cn } from '@/lib/utils';

type DatePreset = 'UPCOMING' | 'THIS_TAX_YEAR' | 'LAST_TAX_YEAR' | 'CUSTOM';

const DATE_PRESET_OPTIONS: { value: DatePreset; label: string }[] = [
  { value: 'UPCOMING', label: 'Upcoming' },
  { value: 'THIS_TAX_YEAR', label: 'This tax year' },
  { value: 'LAST_TAX_YEAR', label: 'Last tax year' },
  { value: 'CUSTOM', label: 'Custom dates' },
];

// UK tax year runs 6 Apr → 5 Apr. yearsAgo=0 = current tax year, yearsAgo=1 = previous.
function computeTaxYear(yearsAgo: 0 | 1): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const afterApril6 = now.getMonth() > 3 || (now.getMonth() === 3 && now.getDate() >= 6);
  const startYear = (afterApril6 ? y : y - 1) - yearsAgo;
  return { from: `${startYear}-04-06`, to: `${startYear + 1}-04-05` };
}

// ─── Filter tabs ─────────────────────────────────────────────────────────────

const FILTERS: { label: string; value: ListTab }[] = [
  { label: 'Active',       value: 'ACTIVE'      },
  { label: 'Enquiry',      value: 'ENQUIRY'     },
  { label: 'Provisional',  value: 'PROVISIONAL' },
  { label: 'Confirmed',    value: 'CONFIRMED'   },
  { label: 'Ready',        value: 'READY'       },
  { label: 'Complete',     value: 'COMPLETE'    },
  { label: 'Cancelled',    value: 'CANCELLED'   },
];

function FilterBar({
  active,
  onChange,
}: {
  active: ListTab | null;
  onChange: (v: ListTab) => void;
}) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (index + 1) % FILTERS.length;
    if (e.key === 'ArrowLeft') next = (index - 1 + FILTERS.length) % FILTERS.length;
    if (next !== null) {
      e.preventDefault();
      tabRefs.current[next]?.focus();
      onChange(FILTERS[next].value);
    }
  }

  return (
    <div
      role="tablist"
      aria-label="Filter bookings by status"
      className="flex gap-0 border-b border-border overflow-x-auto overflow-y-hidden scrollbar-none"
    >
      {FILTERS.map(({ label, value }, index) => (
        <button
          key={value}
          role="tab"
          aria-selected={active === value}
          ref={(el) => { tabRefs.current[index] = el; }}
          tabIndex={active === value ? 0 : -1}
          onClick={() => onChange(value)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          className={cn(
            'px-3 py-2.5 text-sm whitespace-nowrap transition-colors duration-150 -mb-px border-b-2',
            active === value
              ? 'border-primary text-foreground font-medium'
              : 'border-transparent text-muted hover:text-foreground',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Filters sheet ───────────────────────────────────────────────────────────

const EVENT_TYPE_OPTIONS = Object.entries(EVENT_TYPE_LABELS) as [EventType, string][];

function FiltersSheet({
  side,
  eventType,
  onEventTypeChange,
  datePreset,
  from,
  to,
  onDatePresetChange,
  onCustomFromChange,
  onCustomToChange,
}: {
  side: 'bottom' | 'right';
  eventType: EventType | null;
  onEventTypeChange: (v: EventType | null) => void;
  datePreset: DatePreset | null;
  from: string | null;
  to: string | null;
  onDatePresetChange: (v: DatePreset | null) => void;
  onCustomFromChange: (v: string) => void;
  onCustomToChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasDateFilter = !!(from || to);
  const activeCount = (eventType ? 1 : 0) + (hasDateFilter ? 1 : 0);
  const filterAriaLabel = activeCount > 0 ? `Filters, ${activeCount} active` : 'Filters';

  function clearAll() {
    onEventTypeChange(null);
    onDatePresetChange(null);
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="relative shrink-0"
          aria-label={filterAriaLabel}
        >
          <SlidersHorizontal className="h-4 w-4 mr-2" aria-hidden />
          Filters
          {activeCount > 0 && (
            <span
              aria-hidden
              className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center leading-none"
            >
              {activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side={side} className={side === 'bottom' ? 'max-h-[80vh] overflow-y-auto' : undefined}>
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          {/* Event type */}
          <div>
            <p className="text-sm font-medium mb-3">Event type</p>
            <div className="space-y-1">
              <button
                onClick={() => { onEventTypeChange(null); setOpen(false); }}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-md text-base',
                  !eventType ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted',
                )}
              >
                All types
              </button>
              {EVENT_TYPE_OPTIONS.map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => { onEventTypeChange(value); setOpen(false); }}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-md text-base',
                    eventType === value ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div>
            <p className="text-sm font-medium mb-3">Date range</p>
            <div className="space-y-1">
              <button
                onClick={() => { onDatePresetChange(null); setOpen(false); }}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-md text-base',
                  !datePreset ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted',
                )}
              >
                Any date
              </button>
              {DATE_PRESET_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => {
                    onDatePresetChange(value);
                    if (value !== 'CUSTOM') setOpen(false);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-md text-base',
                    datePreset === value ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {datePreset === 'CUSTOM' && (
              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-sm text-muted mb-1">From</p>
                  <DatePicker
                    value={from ?? ''}
                    onChange={onCustomFromChange}
                    placeholder="From date"
                  />
                </div>
                <div>
                  <p className="text-sm text-muted mb-1">To</p>
                  <DatePicker
                    value={to ?? ''}
                    onChange={onCustomToChange}
                    placeholder="To date"
                  />
                </div>
              </div>
            )}
          </div>

          {activeCount > 0 && (
            <Button variant="ghost" className="w-full" onClick={clearAll}>
              Clear filters
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="hidden md:block w-full overflow-x-auto">
      <table className="w-full min-w-[580px] border-collapse">
        <thead>
          <tr className="border-b border-border">
            {['w-12', 'w-20', 'w-24', 'w-16', 'w-10'].map((w, i) => (
              <th key={i} className="px-4 py-2.5 text-left">
                <div className={`h-2.5 ${w} bg-border rounded animate-pulse`} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }).map((_, i) => (
            <tr key={i} className="h-14 border-b border-border">
              <td className="px-4">
                <div className="flex flex-col gap-1.5">
                  <div className="h-3 w-16 bg-border rounded animate-pulse" />
                  <div className="h-2.5 w-10 bg-border rounded animate-pulse opacity-60" />
                </div>
              </td>
              <td className="px-4">
                <div className="flex flex-col gap-1.5">
                  <div className="h-3 w-32 bg-border rounded animate-pulse" />
                  <div className="h-2.5 w-20 bg-border rounded animate-pulse opacity-60" />
                </div>
              </td>
              <td className="px-4">
                <div className="h-3 w-28 bg-border rounded animate-pulse" />
              </td>
              <td className="px-4">
                <div className="h-5 w-20 bg-border rounded-full animate-pulse" />
              </td>
              <td className="px-4">
                <div className="h-3 w-14 bg-border rounded animate-pulse" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BookingsListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const statusParam = searchParams.get('status') as BookingStatus | null;
  const qParam = searchParams.get('q') ?? '';
  const eventTypeParam = searchParams.get('eventType') as EventType | null;
  const datePresetParam = searchParams.get('datePreset') as DatePreset | null;
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  // Local state drives the input immediately; URL is updated with a 300ms debounce.
  const [inputValue, setInputValue] = useState(qParam);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  // Sync the input when the URL q param changes externally (navigation or clear-search action).
  useEffect(() => {
    setInputValue(qParam);
  }, [qParam]);

  // Cleanup debounce timer on unmount.
  useEffect(() => {
    return () => clearTimeout(debounceTimer.current);
  }, []);

  function handleSearchChange(value: string) {
    setInputValue(value);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value.trim()) {
          next.set('q', value);
        } else {
          next.delete('q');
        }
        return next;
      });
    }, 300);
  }

  function handleClearSearch() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('q');
      return next;
    });
  }

  function handleFilterChange(value: ListTab) {
    // 'ACTIVE' clears the status param — it is the resting/default state
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === 'ACTIVE') {
        next.delete('status');
      } else {
        next.set('status', value);
      }
      return next;
    });
  }

  function handleEventTypeChange(value: EventType | null) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) {
        next.set('eventType', value);
      } else {
        next.delete('eventType');
      }
      return next;
    });
  }

  function handleDatePresetChange(preset: DatePreset | null) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('from');
      next.delete('to');
      next.delete('datePreset');
      if (!preset) return next;
      next.set('datePreset', preset);
      const today = new Date().toISOString().slice(0, 10);
      switch (preset) {
        case 'UPCOMING':
          next.set('from', today);
          break;
        case 'THIS_TAX_YEAR': {
          const bounds = computeTaxYear(0);
          next.set('from', bounds.from);
          next.set('to', bounds.to);
          break;
        }
        case 'LAST_TAX_YEAR': {
          const bounds = computeTaxYear(1);
          next.set('from', bounds.from);
          next.set('to', bounds.to);
          break;
        }
        case 'CUSTOM':
          // Preset only — user fills in from/to via custom pickers
          break;
      }
      return next;
    });
  }

  function handleCustomFromChange(value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set('from', value); else next.delete('from');
      return next;
    });
  }

  function handleCustomToChange(value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set('to', value); else next.delete('to');
      return next;
    });
  }

  // q drives the API call only when >= 2 chars; resolveListScope handles the threshold internally.
  const q = qParam.trim().length >= 2 ? qParam : undefined;
  const { effectiveStatuses, highlightedTab } = resolveListScope({
    tab: statusParam ?? undefined,
    q: qParam,
    eventType: eventTypeParam ?? undefined,
    from: fromParam ?? undefined,
    to: toParam ?? undefined,
  });

  const { data = [], isLoading, isError } = useBookings({
    statuses: effectiveStatuses,
    q,
    eventType: eventTypeParam ?? undefined,
    from: fromParam ?? undefined,
    to: toParam ?? undefined,
  });

  const selectValue = highlightedTab ?? 'ACTIVE';
  const defaultSortDesc = highlightedTab === 'COMPLETE';

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl font-semibold text-foreground">Bookings</h1>
        <Button onClick={() => navigate('/admin/bookings/new')}>
          New booking
        </Button>
      </div>

      {/* Search — always-visible, full-width */}
      <div className="mb-4">
        <Input
          type="search"
          placeholder="Search bookings…"
          value={inputValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          aria-label="Search bookings"
        />
      </div>

      {/* Desktop: status tabs + Filters button */}
      <div className="hidden md:flex items-center gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <FilterBar active={highlightedTab} onChange={handleFilterChange} />
        </div>
        <FiltersSheet
          side="right"
          eventType={eventTypeParam}
          onEventTypeChange={handleEventTypeChange}
          datePreset={datePresetParam}
          from={fromParam}
          to={toParam}
          onDatePresetChange={handleDatePresetChange}
          onCustomFromChange={handleCustomFromChange}
          onCustomToChange={handleCustomToChange}
        />
      </div>
      {/* Mobile: status select + Filters button */}
      <div className="md:hidden mb-4 flex gap-2">
        <Select value={selectValue} onValueChange={(v) => handleFilterChange(v as ListTab)}>
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTERS.map(({ label, value }) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FiltersSheet
          side="bottom"
          eventType={eventTypeParam}
          onEventTypeChange={handleEventTypeChange}
          datePreset={datePresetParam}
          from={fromParam}
          to={toParam}
          onDatePresetChange={handleDatePresetChange}
          onCustomFromChange={handleCustomFromChange}
          onCustomToChange={handleCustomToChange}
        />
      </div>

      {/* Content */}
      <div className="mt-1">
        {isLoading && <TableSkeleton />}

        {!isLoading && isError && (
          <div className="py-12 text-center text-sm text-muted">
            Failed to load bookings.{' '}
            <button
              className="text-primary underline underline-offset-2"
              onClick={() => setSearchParams(searchParams)}
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && (
          <BookingsTable
            key={String(highlightedTab)}
            data={data}
            onNew={() => navigate('/admin/bookings/new')}
            defaultSortDesc={defaultSortDesc}
            searchQuery={q}
            onClearSearch={handleClearSearch}
          />
        )}
      </div>
    </div>
  );
}
