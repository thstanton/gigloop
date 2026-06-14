import { useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import BookingsTable from '@/features/bookings/BookingsTable';
import { useBookings } from '@/lib/hooks/useBookings';
import { resolveListScope, type ListTab } from '@/lib/bookingScope';
import type { BookingStatus } from '@/types/api';
import { cn } from '@/lib/utils';

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
  const { effectiveStatuses, highlightedTab } = resolveListScope({ tab: statusParam ?? undefined });

  const { data = [], isLoading, isError } = useBookings({ statuses: effectiveStatuses });

  function handleFilterChange(value: ListTab) {
    // 'ACTIVE' clears the status param — it is the resting/default state
    setSearchParams(value === 'ACTIVE' ? {} : { status: value });
  }

  const selectValue = highlightedTab ?? 'ACTIVE';
  const defaultSortDesc = highlightedTab === 'COMPLETE';

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-semibold text-foreground">Bookings</h1>
        <Button onClick={() => navigate('/admin/bookings/new')}>
          New booking
        </Button>
      </div>

      {/* Filter — tabs on desktop, select on mobile */}
      <div className="hidden md:block">
        <FilterBar active={highlightedTab} onChange={handleFilterChange} />
      </div>
      <div className="md:hidden mb-4">
        <Select value={selectValue} onValueChange={(v) => handleFilterChange(v as ListTab)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTERS.map(({ label, value }) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          />
        )}
      </div>
    </div>
  );
}
