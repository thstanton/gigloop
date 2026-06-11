import { useState } from 'react';
import { useAuth } from '@clerk/react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useBooking } from '@/lib/hooks/useBooking';
import { useBookingChecklist } from '@/lib/hooks/useBookingChecklist';
import { BookingDetailSheets } from '@/features/bookings/BookingDetailSheets';
import { BookingDetailDesktop } from '@/features/bookings/BookingDetailDesktop';
import { BookingDetailMobile } from '@/features/bookings/BookingDetailMobile';
import BookingOverviewStrip from '@/features/bookings/BookingOverviewStrip';
import type { Contract } from '@/types/api';

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="px-4 md:px-6 py-6 max-w-7xl mx-auto animate-pulse">
      {/* Back link */}
      <div className="h-4 w-20 bg-border rounded" />

      <div className="mt-6 md:grid md:grid-cols-[3fr_2fr] md:gap-8 md:items-start">

        {/* Left column */}
        <div className="space-y-8">

          {/* Header */}
          <div className="space-y-3">
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

          {/* People */}
          <div className="space-y-2">
            <div className="h-4 w-16 bg-border rounded" />
            <div className="border-t border-border divide-y divide-border">
              <div className="flex items-center gap-3 py-3">
                <div className="h-8 w-8 bg-border rounded-full flex-shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-32 bg-border rounded" />
                  <div className="h-3 w-20 bg-border rounded" />
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <div className="h-4 w-12 bg-border rounded" />
            <div className="h-16 w-full bg-border rounded" />
          </div>

          {/* For the day */}
          <div className="space-y-4">
            <div className="h-4 w-24 bg-border rounded" />
            <div className="h-40 w-full bg-border rounded-lg" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="h-28 bg-border rounded-lg" />
              <div className="h-28 bg-border rounded-lg" />
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
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const backNav = (location.state as { from?: string; label?: string } | null);

  // pendingContract: a full Contract object from createContract callback — not URL-serializable
  const [pendingContract, setPendingContract] = useState<Contract | null>(null);

  const { isLoaded } = useAuth();
  const { data: booking, isLoading, isError } = useBooking(id!);

  const {
    readyDialogStatus,
    celebratoryTitle,
    dismissReadyDialog,
    confirmStatusTransition,
  } = useBookingChecklist(id!, booking, isLoaded);


  if (isLoading) return <PageSkeleton />;

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

      {/* Back */}
      <Link
        to={backNav?.from ?? '/admin/bookings'}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors"
      >
        <ChevronLeft size={14} />
        {backNav?.label ?? 'Bookings'}
      </Link>

      {/* ─── Overview strip (always visible) ─── */}
      <BookingOverviewStrip bookingId={id!} />

      {/* ─── Mobile layout ─── */}
      <div className="md:hidden">
        <BookingDetailMobile bookingId={id!} />
      </div>

      <BookingDetailDesktop
        bookingId={id!}
        onCreateContract={(contract) => setPendingContract(contract)}
      />

      <BookingDetailSheets
        bookingId={id!}
        pendingContract={pendingContract}
        onPendingContractClear={() => setPendingContract(null)}
        readyDialogStatus={readyDialogStatus}
        celebratoryTitle={celebratoryTitle}
        dismissReadyDialog={dismissReadyDialog}
        confirmStatusTransition={confirmStatusTransition}
      />
    </div>
  );
}
