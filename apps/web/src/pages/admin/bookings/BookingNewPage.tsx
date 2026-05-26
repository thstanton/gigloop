import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronLeft } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import {
  BookingFormFields,
  bookingFormSchema,
  type BookingFormValues,
} from '@/features/bookings/BookingFormFields';
import { apiGet, apiPost } from '@/lib/api';
import type { BookingDetail, EventType, BookingStatus, UserProfile, PerformanceFormat } from '@/types/api';

export default function BookingNewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { isLoaded } = useAuth();

  const locationState = location.state as { customerId?: string; date?: string } | null;

  const { data: userProfile } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<UserProfile>('/me'),
    enabled: isLoaded,
  });

  const { data: formats } = useQuery({
    queryKey: ['performance-formats'],
    queryFn: () => apiGet<PerformanceFormat[]>('/performance-formats'),
    enabled: isLoaded && (userProfile?.songRequestFormEnabled ?? false),
  });

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      eventType: 'WEDDING',
      date: locationState?.date ?? '',
      status: 'CONFIRMED',
      title: '',
      fee: '',
      notes: '',
      customerId: locationState?.customerId ?? '',
      venueId: null,
      referrerId: null,
      formatIds: [],
    },
  });

  useEffect(() => {
    if (locationState?.customerId) {
      setValue('customerId', locationState.customerId);
    }
    if (locationState?.date) {
      setValue('date', locationState.date);
    }
  }, [locationState?.customerId, locationState?.date, setValue]);

  const mutation = useMutation({
    mutationFn: (values: BookingFormValues) =>
      apiPost<BookingDetail>('/bookings', {
        eventType: values.eventType as EventType,
        date: values.date,
        customerId: values.customerId,
        status: values.status as BookingStatus,
        title: values.title || undefined,
        fee: values.fee ? parseFloat(values.fee) : undefined,
        notes: values.notes || undefined,
        venueId: values.venueId ?? undefined,
        referrerId: values.referrerId ?? undefined,
        formatIds: values.formatIds.length ? values.formatIds : undefined,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      navigate(`/admin/bookings/${created.id}`);
    },
  });

  return (
    <div className="px-6 py-8 max-w-2xl">
      <Link
        to="/admin/bookings"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft size={14} />
        Bookings
      </Link>

      <h1 className="text-2xl font-semibold text-foreground mb-8">New booking</h1>

      <form
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        className="space-y-6"
      >
        <BookingFormFields
          control={control}
          register={register}
          errors={errors}
          songRequestFormEnabled={userProfile?.songRequestFormEnabled}
          formats={formats}
        />

        {mutation.isError && (
          <p className="text-sm text-status-cancelled">
            Failed to create booking. Please try again.
          </p>
        )}
        <div className="flex gap-3">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Creating...' : 'Create booking'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/admin/bookings')}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
