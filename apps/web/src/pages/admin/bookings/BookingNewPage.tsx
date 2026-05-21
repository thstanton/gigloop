import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ContactPicker from '@/features/bookings/ContactPicker';
import { apiPost } from '@/lib/api';
import type { BookingDetail, CreateBookingInput, EventType, BookingStatus } from '@/types/api';
import { EVENT_TYPE_LABELS } from '@/lib/constants';

// ─── Schema ───────────────────────────────────────────────────────────────────

const setSchema = z.object({
  label: z.string(),
  duration: z.string().min(1, 'Duration is required'),
  startTime: z.string(),
});

const schema = z.object({
  eventType: z.enum(['WEDDING', 'CORPORATE', 'PRIVATE', 'RESIDENCY', 'OTHER'] as const),
  date: z.string().min(1, 'Date is required'),
  status: z.enum(['ENQUIRY', 'CONFIRMED', 'INVOICED', 'SETTLED', 'COMPLETED', 'CANCELLED'] as const),
  title: z.string(),
  fee: z.string(),
  notes: z.string(),
  customerId: z.string().min(1, 'Customer is required'),
  venueId: z.string().nullable(),
  referrerId: z.string().nullable(),
  sets: z.array(setSchema),
});

type FormValues = z.infer<typeof schema>;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BookingNewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const locationState = location.state as { customerId?: string } | null;

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      eventType: 'WEDDING',
      date: '',
      status: 'CONFIRMED',
      title: '',
      fee: '',
      notes: '',
      customerId: locationState?.customerId ?? '',
      venueId: null,
      referrerId: null,
      sets: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'sets' });

  useEffect(() => {
    if (locationState?.customerId) {
      setValue('customerId', locationState.customerId);
    }
  }, [locationState?.customerId, setValue]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const body: CreateBookingInput = {
        eventType: values.eventType as EventType,
        date: values.date,
        customerId: values.customerId,
        status: values.status as BookingStatus,
        title: values.title || undefined,
        fee: values.fee ? parseFloat(values.fee) : undefined,
        notes: values.notes || undefined,
        venueId: values.venueId ?? undefined,
        referrerId: values.referrerId ?? undefined,
        sets: fields.length
          ? values.sets.map((s, i) => ({
              order: i,
              duration: parseInt(s.duration, 10),
              startTime: s.startTime || undefined,
              label: s.label || undefined,
            }))
          : undefined,
      };
      return apiPost<BookingDetail>('/bookings', body);
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      navigate(`/admin/bookings/${created.id}`);
    },
  });

  function onSubmit(values: FormValues) {
    mutation.mutate(values);
  }

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

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Event type + Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Event type</Label>
            <Controller
              name="eventType"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(EVENT_TYPE_LABELS) as [EventType, string][]).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" {...register('date')} />
            {errors.date && (
              <p className="text-sm text-status-cancelled">{errors.date.message}</p>
            )}
          </div>
        </div>

        {/* Status + Fee */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ENQUIRY">Enquiry</SelectItem>
                    <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                    <SelectItem value="INVOICED">Invoiced</SelectItem>
                    <SelectItem value="SETTLED">Settled</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Fee (optional)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              {...register('fee')}
            />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <Label>Title (optional)</Label>
          <Input placeholder="e.g. Smith Wedding" {...register('title')} />
        </div>

        {/* People */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">People</h2>

          <div className="space-y-1.5">
            <Label>Customer</Label>
            <Controller
              name="customerId"
              control={control}
              render={({ field }) => (
                <ContactPicker
                  value={field.value || null}
                  onChange={(id) => field.onChange(id ?? '')}
                  placeholder="Select customer..."
                  label="customer"
                />
              )}
            />
            {errors.customerId && (
              <p className="text-sm text-status-cancelled">{errors.customerId.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Venue (optional)</Label>
            <Controller
              name="venueId"
              control={control}
              render={({ field }) => (
                <ContactPicker
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select venue..."
                  label="venue"
                />
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Referrer (optional)</Label>
            <Controller
              name="referrerId"
              control={control}
              render={({ field }) => (
                <ContactPicker
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select referrer..."
                  label="referrer"
                />
              )}
            />
          </div>
        </div>

        {/* Sets */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Sets</h2>
            <button
              type="button"
              onClick={() => append({ label: '', duration: '60', startTime: '' })}
              className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              <Plus size={14} />
              Add set
            </button>
          </div>

          {fields.length === 0 && (
            <p className="text-sm text-muted">No sets added yet.</p>
          )}

          {fields.map((field, index) => (
            <div key={field.id} className="border border-border rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Set {index + 1}</span>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="text-muted hover:text-foreground transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Label (optional)</Label>
                  <Input placeholder="e.g. Ceremony" {...register(`sets.${index}.label`)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Duration (min)</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="60"
                    {...register(`sets.${index}.duration`)}
                  />
                  {errors.sets?.[index]?.duration?.message && (
                    <p className="text-sm text-status-cancelled">
                      {errors.sets[index].duration?.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Start time (optional)</Label>
                  <Input type="time" {...register(`sets.${index}.startTime`)} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label>Notes (optional)</Label>
          <Textarea rows={3} placeholder="Any notes about this booking..." {...register('notes')} />
        </div>

        {/* Actions */}
        {mutation.isError && (
          <p className="text-sm text-status-cancelled">Failed to create booking. Please try again.</p>
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
