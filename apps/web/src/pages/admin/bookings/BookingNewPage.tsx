import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  BookingFormFields,
  bookingFormSchema,
  type BookingFormValues,
} from '@/features/bookings/BookingFormFields';
import { ChecklistStep } from '@/features/bookings/ChecklistStep';
import { CreatedCheckpoint } from '@/features/bookings/CreatedCheckpoint';
import { useBookingNewData } from '@/features/bookings/useBookingNewData';
import { useCreateBooking } from '@/features/bookings/useCreateBooking';
import { EVENT_TYPE_LABELS } from '@/lib/constants';
import type { BookingStatus, ChecklistDefaultItem } from '@/types/api';

interface BookingNewLocationState {
  customerId?: string;
  venueId?: string;
  bookingAgentId?: string;
  date?: string;
  seriesId?: string;
}

// Prefills (customer/venue/agent/date/series) from the originating screen flow through the form's
// defaults into the controlled atom cores; the profile-driven status default is applied post-mount
// in useBookingNewData.
function buildBookingDefaultValues(state: BookingNewLocationState | null): BookingFormValues {
  return {
    overview: {
      eventType: 'WEDDING',
      date: state?.date ?? '',
      fee: '',
      title: '',
      seriesMode: state?.seriesId ? 'existing' : 'none',
      seriesId: state?.seriesId ?? null,
      newSeriesLabel: '',
    },
    status: 'PROVISIONAL',
    notes: '',
    customer: { kind: 'existing', contactId: state?.customerId ?? null },
    bookingAgent: { kind: 'existing', contactId: state?.bookingAgentId ?? null },
    venue: { kind: 'existing', venueId: state?.venueId ?? null },
    packageTemplateIds: [],
    enableMusicForm: false,
  };
}

export default function BookingNewPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState<1 | 2>(1);
  const [pendingValues, setPendingValues] = useState<BookingFormValues | null>(null);

  const { control, handleSubmit, setValue, formState: { errors } } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: buildBookingDefaultValues(location.state as BookingNewLocationState | null),
  });

  const previewStatus = pendingValues?.status as BookingStatus | undefined;
  const { userProfile, formats, seriesList, reminderPreview, isPreviewLoading, checklistDefaults } =
    useBookingNewData({ previewStatus, setValue });

  const { created, isCreating, isError, create, reset } = useCreateBooking();

  if (created) {
    return (
      <div className="px-6 py-8 max-w-3xl mx-auto">
        <CreatedCheckpoint
          title={created.title || EVENT_TYPE_LABELS[created.eventType]}
          onFinish={() => navigate(`/admin/bookings/${created.id}`)}
          onContinue={() => navigate(`/admin/bookings/${created.id}/builder`)}
        />
      </div>
    );
  }

  // The form stays mounted (hidden) while the checklist step shows, so the uncontrolled People/
  // Venue atom cores keep their typed new-contact state if the musician steps Back (ADR-0053).
  return (
    <>
      <div className={step === 2 ? 'hidden' : 'px-6 py-8 max-w-3xl mx-auto'}>
        <PageHeader title="New booking" backHref="/admin/bookings" backLabel="Bookings" />

        <form onSubmit={handleSubmit((values) => { setPendingValues(values); setStep(2); })} className="space-y-6">
          <BookingFormFields
            control={control}
            errors={errors}
            songRequestFormEnabled={userProfile?.songRequestFormEnabled}
            formats={formats}
            series={seriesList}
          />

          <div className="flex gap-3">
            <Button type="submit">
              Next: Reminders
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/admin/bookings')}>
              Cancel
            </Button>
          </div>
        </form>
      </div>

      {step === 2 && pendingValues && (
        <ChecklistStep
          preview={reminderPreview}
          isPreviewLoading={isPreviewLoading}
          checklistDefaults={checklistDefaults}
          startingStatus={pendingValues.status as BookingStatus}
          onBack={() => { reset(); setStep(1); }}
          onCreate={(checklistItems: ChecklistDefaultItem[]) => create({ values: pendingValues, checklistItems })}
          isCreating={isCreating}
          isError={isError}
        />
      )}
    </>
  );
}
