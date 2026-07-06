import { Link, useLocation, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useBooking } from '@/lib/hooks/useBooking';
import { BookingDetailSheets } from '@/features/bookings/BookingDetailSheets';
import { BookingDetailDesktop } from '@/features/bookings/BookingDetailDesktop';
import { BookingDetailMobile, MobileTabsSkeleton } from '@/features/bookings/BookingDetailMobile';
import BookingOverviewStrip from '@/features/bookings/BookingOverviewStrip';

// ─── Skeletons ───────────────────────────────────────────────────────────────

function OverviewStripSkeleton() {
  return (
    <div className="mt-6 space-y-3 animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="h-8 w-48 bg-border rounded" />
        <div className="flex gap-2">
          <div className="h-8 w-24 bg-border rounded" />
          <div className="h-8 w-16 bg-border rounded" />
        </div>
      </div>
      <div className="flex gap-3">
        <div className="h-6 w-24 bg-border rounded-full" />
        <div className="h-6 w-28 bg-border rounded" />
        <div className="h-6 w-20 bg-border rounded" />
      </div>
    </div>
  );
}

function DesktopGridSkeleton() {
  return (
    <div className="mt-6 md:grid md:grid-cols-[3fr_2fr] md:gap-8 md:items-start animate-pulse">
      {/* Left column */}
      <div className="space-y-8">
        {/* For the day */}
        <div className="space-y-4">
          <div className="h-4 w-24 bg-border rounded" />
          <div className="h-40 w-full bg-border rounded-lg" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="h-28 bg-border rounded-lg" />
            <div className="h-28 bg-border rounded-lg" />
          </div>
        </div>

        {/* Packages */}
        <div className="space-y-4">
          <div className="h-4 w-24 bg-border rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="h-32 bg-border rounded-lg" />
            <div className="h-32 bg-border rounded-lg" />
          </div>
        </div>
      </div>

      {/* Right column */}
      <div className="mt-8 md:mt-0 space-y-6">
        <div className="h-48 bg-border rounded-lg" />
        <div className="h-32 bg-border rounded-lg" />
        <div className="h-40 bg-border rounded-lg" />
        <div className="h-24 bg-border rounded-lg" />
        <div className="h-24 bg-border rounded-lg" />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const backNav = (location.state as { from?: string; label?: string } | null);

  const { data: booking, isLoading, isError } = useBooking(id!);

  if (isLoading) {
    return (
      <div className="px-4 md:px-6 py-6 max-w-7xl mx-auto">
        <div className="h-4 w-20 bg-border rounded" />
        <OverviewStripSkeleton />
        <div className="md:hidden mt-6"><MobileTabsSkeleton /></div>
        <div className="hidden md:block"><DesktopGridSkeleton /></div>
      </div>
    );
  }

  if (isError || !booking) {
    return (
      <div className="px-4 md:px-6 py-6">
        <p className="text-sm text-muted">Booking not found.</p>
        <Link
          to="/admin/bookings"
          className="text-sm text-primary underline underline-offset-2 mt-2 block"
        >
          Back to bookings
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 py-6 max-w-7xl mx-auto">
      <Link
        to={backNav?.from ?? '/admin/bookings'}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors"
      >
        <ChevronLeft size={14} />
        {backNav?.label ?? 'Bookings'}
      </Link>

      <BookingOverviewStrip bookingId={id!} />

      <div className="md:hidden" data-testid="booking-detail-mobile">
        <BookingDetailMobile bookingId={id!} />
      </div>

      <div className="hidden md:block" data-testid="booking-detail-desktop">
        <BookingDetailDesktop bookingId={id!} />
      </div>

      <BookingDetailSheets bookingId={id!} />
    </div>
  );
}
