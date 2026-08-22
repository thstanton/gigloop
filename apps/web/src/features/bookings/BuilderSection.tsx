import { RemindMeAboutContainer } from '@/features/bookings/RemindMeAboutContainer';
import type { SpineId } from '@/features/bookings/builderCompleteness';
import type { BookingStatus, ReminderConcern } from '@/types/api';

// Generic section wrapper shared by every Booking Builder concern — owns the
// scroll-target id, the heading, the bordered card chrome and (where a concern
// has one) the "Remind me about" control, so each concern only supplies its
// own atom.
export function BuilderSection({
  id,
  title,
  refCallback,
  remind,
  children,
}: {
  id: SpineId;
  title: string;
  refCallback?: React.RefCallback<HTMLElement>;
  remind?: { bookingId: string; concern: ReminderConcern; currentStatus: BookingStatus };
  children: React.ReactNode;
}) {
  return (
    <section
      id={`builder-${id}`}
      ref={refCallback}
      // Mobile clears the fixed top bar (h-14) + the fixed stepper; desktop just the bar.
      className="scroll-mt-36 md:scroll-mt-8"
    >
      <h2 className="mb-3 text-base font-semibold text-foreground">{title}</h2>
      <div className="rounded-lg border border-border bg-background p-4">
        {children}
        {remind && (
          <div className="mt-6">
            <RemindMeAboutContainer
              bookingId={remind.bookingId}
              concern={remind.concern}
              currentStatus={remind.currentStatus}
            />
          </div>
        )}
      </div>
    </section>
  );
}
