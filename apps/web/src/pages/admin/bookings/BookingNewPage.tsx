import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { Button } from '@/components/ui/button';
import {
  BookingFormFields,
  bookingFormSchema,
  type BookingFormValues,
} from '@/features/bookings/BookingFormFields';
import { ChecklistStep } from '@/features/bookings/ChecklistStep';
import { apiGet, apiPost } from '@/lib/api';
import type {
  BookingDetail,
  BookingSeries,
  BookingStatus,
  ChecklistDefaultItem,
  EventType,
  PackageTemplate,
  UserProfile,
} from '@/types/api';

function buildSeriesPayload(values: BookingFormValues): { seriesId?: string; newSeries?: { label: string } } {
  if (values.seriesMode === 'existing' && values.seriesId) return { seriesId: values.seriesId };
  if (values.seriesMode === 'new' && values.newSeriesLabel?.trim()) return { newSeries: { label: values.newSeriesLabel.trim() } };
  return {};
}

function buildBookingPayload(values: BookingFormValues, checklistItems: ChecklistDefaultItem[]) {
  return {
    eventType: values.eventType as EventType,
    date: values.date,
    customerId: values.customerId,
    status: values.status as BookingStatus,
    title: values.title || undefined,
    fee: values.fee ? parseFloat(values.fee) : undefined,
    notes: values.notes || undefined,
    venueId: values.venueId ?? undefined,
    bookingAgentId: values.bookingAgentId ?? undefined,
    packageTemplateIds: values.packageTemplateIds.length ? values.packageTemplateIds : undefined,
    enableMusicForm: values.enableMusicForm,
    checklistItems,
    ...buildSeriesPayload(values),
  };
}

export default function BookingNewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { isLoaded } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [pendingValues, setPendingValues] = useState<BookingFormValues | null>(null);

  const locationState = location.state as { customerId?: string; venueId?: string; bookingAgentId?: string; date?: string; seriesId?: string } | null;

  const { data: userProfile } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<UserProfile>('/me'),
    enabled: isLoaded,
  });

  const { data: formats } = useQuery({
    queryKey: ['packages'],
    queryFn: () => apiGet<PackageTemplate[]>('/packages'),
    enabled: isLoaded && (userProfile?.songRequestFormEnabled ?? false),
  });

  const { data: seriesList } = useQuery({
    queryKey: ['series'],
    queryFn: () => apiGet<BookingSeries[]>('/series'),
    enabled: isLoaded,
  });

  const { register, control, handleSubmit, setValue, formState: { errors } } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      eventType: 'WEDDING',
      date: locationState?.date ?? '',
      status: 'PROVISIONAL',
      title: '',
      fee: '',
      notes: '',
      customerId: locationState?.customerId ?? '',
      venueId: locationState?.venueId ?? null,
      bookingAgentId: locationState?.bookingAgentId ?? null,
      packageTemplateIds: [],
      enableMusicForm: false,
      seriesMode: 'none',
      seriesId: null,
      newSeriesLabel: '',
    },
  });

  useEffect(() => {
    if (locationState?.customerId) setValue('customerId', locationState.customerId);
    if (locationState?.venueId) setValue('venueId', locationState.venueId);
    if (locationState?.bookingAgentId) setValue('bookingAgentId', locationState.bookingAgentId);
    if (locationState?.date) setValue('date', locationState.date);
    if (locationState?.seriesId) {
      setValue('seriesMode', 'existing');
      setValue('seriesId', locationState.seriesId);
    }
  }, [locationState?.customerId, locationState?.venueId, locationState?.bookingAgentId, locationState?.date, locationState?.seriesId, setValue]);

  useEffect(() => {
    if (!userProfile) return;
    const pref = (userProfile.preferences as { defaultBookingStatus?: string } | undefined)?.defaultBookingStatus ?? 'PROVISIONAL';
    setValue('status', pref as BookingFormValues['status']);
    // Music form defaults on when the user has song request forms enabled (set once on profile load,
    // so a manual toggle afterwards is never clobbered — id is stable across refetches).
    setValue('enableMusicForm', userProfile.songRequestFormEnabled);
  }, [userProfile?.id, setValue]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: ({ values, checklistItems }: { values: BookingFormValues; checklistItems: ChecklistDefaultItem[] }) =>
      apiPost<BookingDetail>('/bookings', buildBookingPayload(values, checklistItems)),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      navigate(`/admin/bookings/${created.id}`);
    },
  });

  const checklistDefaults: ChecklistDefaultItem[] =
    userProfile?.preferences?.checklistDefaults || [];

  if (step === 2 && pendingValues) {
    return (
      <ChecklistStep
        defaults={checklistDefaults}
        startingStatus={pendingValues.status as BookingStatus}
        onBack={() => { mutation.reset(); setStep(1); }}
        onCreate={(checklistItems) => mutation.mutate({ values: pendingValues, checklistItems })}
        isCreating={mutation.isPending}
        isError={mutation.isError}
      />
    );
  }

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto">
      <PageHeader title="New booking" backHref="/admin/bookings" backLabel="Bookings" />

      <form onSubmit={handleSubmit((values) => { setPendingValues(values); setStep(2); })} className="space-y-6">
        <BookingFormFields
          control={control}
          register={register}
          errors={errors}
          songRequestFormEnabled={userProfile?.songRequestFormEnabled}
          formats={formats}
          series={seriesList}
        />

        <div className="flex gap-3">
          <Button type="submit">
            Next: Checklist
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/admin/bookings')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
