import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { useUser } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, AlertCircle, RotateCcw } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { useBookings } from '@/lib/hooks/useBookings';
import BookingStatusPill from '@/components/domain/BookingStatusPill';
import { formatDate } from '@/lib/formatters';
import type { DashboardAction, BookingListItem } from '@/types/api';
import { cn } from '@/lib/utils';

// ─── Upcoming gigs ────────────────────────────────────────────────────────────

function upcomingGigs(bookings: BookingListItem[]): BookingListItem[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + 90);

  return bookings
    .filter((b) => {
      if (b.status === 'CANCELLED' || b.status === 'ENQUIRY') return false;
      const d = new Date(b.date);
      return d >= today && d <= cutoff;
    })
    .slice(0, 8);
}

function UpcomingGigsWidget({ bookings }: { bookings: BookingListItem[] }) {
  const navigate = useNavigate();
  const gigs = upcomingGigs(bookings);

  if (gigs.length === 0) {
    return (
      <p className="text-muted text-sm py-2">No upcoming gigs in the next 90 days.</p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {gigs.map((g) => (
        <li key={g.id}>
          <button
            onClick={() => navigate(`/admin/bookings/${g.id}`, { state: { from: '/admin', label: 'Dashboard' } })}
            className="w-full flex items-start justify-between gap-4 py-3 text-left hover:bg-muted/30 transition-colors -mx-4 px-4"
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm text-foreground truncate">
                {g.title ?? g.customer.name}
              </span>
              {g.title && (
                <span className="text-xs text-muted truncate">{g.customer.name}</span>
              )}
              {g.venue && (
                <span className="text-xs text-muted truncate">{g.venue.name}</span>
              )}
              <div className="mt-1">
                <BookingStatusPill status={g.status} />
              </div>
            </div>
            <span className="text-xs text-muted flex-shrink-0 mt-0.5">{formatDate(g.date)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// ─── Actions ──────────────────────────────────────────────────────────────────

function ActionsWidget() {
  const { isLoaded } = useAuth();
  const navigate = useNavigate();

  const { data: actions = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['bookings', 'actions'],
    queryFn: () => apiGet<DashboardAction[]>('/bookings/actions'),
    enabled: isLoaded,
  });

  if (isLoading) {
    return (
      <ul className="divide-y divide-border">
        {Array.from({ length: 3 }).map((_, i) => (
          <li key={i} className="py-3 flex items-center gap-3">
            <div className="h-3 w-24 bg-border rounded animate-pulse" />
            <div className="h-3 w-32 bg-border rounded animate-pulse ml-auto" />
          </li>
        ))}
      </ul>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted py-2">
        <AlertCircle className="size-4 flex-shrink-0" />
        <span>Failed to load actions.</span>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1 text-primary underline underline-offset-2 ml-1"
        >
          <RotateCcw className="size-3" />
          Retry
        </button>
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <p className="text-muted text-sm py-2">No actions needed right now.</p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {actions.map((a) => (
        <li key={a.bookingId}>
          <button
            onClick={() => navigate(`/admin/bookings/${a.bookingId}`, { state: { from: '/admin', label: 'Dashboard' } })}
            className="w-full flex items-start justify-between gap-4 py-3 text-left hover:bg-muted/30 transition-colors -mx-4 px-4"
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm text-foreground truncate">
                {a.bookingTitle ?? a.customerName}
              </span>
              {a.bookingTitle && (
                <span className="text-xs text-muted truncate">{a.customerName}</span>
              )}
              <span
                className={cn(
                  'text-xs font-medium mt-0.5',
                  a.item.state === 'failed' ? 'text-status-cancelled' : 'text-primary',
                )}
              >
                {a.item.label}
              </span>
            </div>
            <span className="text-xs text-muted flex-shrink-0 mt-0.5">
              {formatDate(a.bookingDate)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_HEADERS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function CalendarWidget({ bookings }: { bookings: BookingListItem[] }) {
  const navigate = useNavigate();
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [expanded, setExpanded] = useState<string | null>(null);

  const todayStr = toLocalDateString(now);

  const byDate = new Map<string, BookingListItem[]>();
  for (const b of bookings) {
    if (b.status === 'CANCELLED' || b.status === 'ENQUIRY') continue;
    const key = b.date.slice(0, 10);
    const existing = byDate.get(key) ?? [];
    existing.push(b);
    byDate.set(key, existing);
  }

  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Mon-start: Mon=0..Sun=6
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
    setExpanded(null);
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
    setExpanded(null);
  }

  function handleDayClick(dayNum: number) {
    const d = new Date(year, month, dayNum);
    const key = toLocalDateString(d);
    const gigsOnDay = byDate.get(key);

    if (gigsOnDay && gigsOnDay.length > 0) {
      if (gigsOnDay.length === 1) {
        navigate(`/admin/bookings/${gigsOnDay[0].id}`, { state: { from: '/admin', label: 'Calendar' } });
      } else {
        setExpanded(expanded === key ? null : key);
      }
    } else {
      navigate('/admin/bookings/new', { state: { date: key } });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          className="p-1 rounded hover:bg-muted/40 transition-colors text-muted hover:text-foreground"
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-medium text-foreground">
          {MONTH_NAMES[month]} {year}
        </span>
        <button
          onClick={nextMonth}
          className="p-1 rounded hover:bg-muted/40 transition-colors text-muted hover:text-foreground"
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DAY_HEADERS.map((d) => (
          <div key={d} className="text-center text-xs text-muted py-1 font-medium">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {Array.from({ length: totalCells }).map((_, i) => {
          const dayNum = i - startOffset + 1;
          if (dayNum < 1 || dayNum > daysInMonth) {
            return <div key={i} />;
          }

          const key = toLocalDateString(new Date(year, month, dayNum));
          const gigsOnDay = byDate.get(key) ?? [];
          const isToday = key === todayStr;
          const isExpanded = expanded === key;

          return (
            <button
              key={i}
              onClick={() => handleDayClick(dayNum)}
              className={cn(
                'flex flex-col items-center py-1.5 rounded transition-colors hover:bg-muted/40',
                isExpanded && 'bg-muted/40',
              )}
            >
              <span
                className={cn(
                  'text-xs w-6 h-6 flex items-center justify-center rounded-full',
                  isToday
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'text-foreground',
                )}
              >
                {dayNum}
              </span>
              {gigsOnDay.length > 0 && (
                <span className="flex gap-0.5 mt-0.5">
                  {gigsOnDay.slice(0, 3).map((_, dotIdx) => (
                    <span key={dotIdx} className="block w-1 h-1 rounded-full bg-primary" />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {expanded && (byDate.get(expanded)?.length ?? 0) > 0 && (
        <ul className="mt-3 divide-y divide-border border-t border-border pt-3">
          {(byDate.get(expanded) ?? []).map((b) => (
            <li key={b.id}>
              <button
                onClick={() => navigate(`/admin/bookings/${b.id}`, { state: { from: '/admin', label: 'Calendar' } })}
                className="w-full flex items-start justify-between gap-3 py-2 text-left hover:bg-muted/30 transition-colors -mx-4 px-4"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm text-foreground">
                    {b.title ?? b.customer.name}
                  </span>
                  <BookingStatusPill status={b.status} />
                </div>
                {b.sets[0]?.startTime && (
                  <span className="text-xs text-muted flex-shrink-0 mt-0.5">{b.sets[0].startTime}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Widget shell ─────────────────────────────────────────────────────────────

function Widget({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border p-4">
      <h2 className="text-base font-semibold text-foreground mb-3">{title}</h2>
      {children}
    </section>
  );
}

function WidgetSkeleton() {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="h-4 w-32 bg-border rounded animate-pulse mb-4" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-10 border-b border-border flex items-center gap-3 last:border-0">
          <div className="h-3 w-24 bg-border rounded animate-pulse" />
          <div className="h-3 w-16 bg-border rounded animate-pulse ml-auto" />
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function nextUpcomingGig(bookings: BookingListItem[]): BookingListItem | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (
    bookings
      .filter((b) => b.status !== 'CANCELLED' && b.status !== 'ENQUIRY' && new Date(b.date) >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
  );
}

export default function DashboardPage() {
  const { data: bookings = [], isLoading } = useBookings('ALL');
  const { user } = useUser();

  const firstName = user?.firstName ?? '';
  const nextGig = nextUpcomingGig(bookings);

  return (
    <div className="min-h-screen">
      <div className="px-4 md:px-8 py-8 max-w-7xl mx-auto">

        {/* Welcome */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-semibold text-foreground">
            {greeting()}{firstName ? `, ${firstName}` : ''}.
          </h1>
          {!isLoading && (
            <p className="text-base text-muted mt-1">
              {nextGig
                ? <>Your next gig is <span className="text-foreground font-medium">{nextGig.title ?? nextGig.customer?.name}</span> on {formatDate(nextGig.date)}.</>
                : 'No upcoming gigs scheduled.'}
            </p>
          )}
        </div>

        {/* Two-column grid */}
        <div className="md:grid md:grid-cols-2 md:gap-8 space-y-4 md:space-y-0">

          {/* Left: Actions */}
          <div className="space-y-4">
            <Widget title="Actions">
              <ActionsWidget />
            </Widget>
          </div>

          {/* Right: Calendar + Upcoming */}
          <div className="space-y-4">
            {isLoading ? (
              <WidgetSkeleton />
            ) : (
              <Widget title="Calendar">
                <CalendarWidget bookings={bookings} />
              </Widget>
            )}
            {isLoading ? (
              <WidgetSkeleton />
            ) : (
              <Widget title="Upcoming gigs">
                <UpcomingGigsWidget bookings={bookings} />
              </Widget>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
