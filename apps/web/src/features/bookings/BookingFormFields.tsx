import { Controller } from 'react-hook-form';
import type { Control, UseFormRegister, FieldErrors, FieldArrayWithId } from 'react-hook-form';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ContactPicker from './ContactPicker';
import { EVENT_TYPE_LABELS } from '@/lib/constants';
import type { EventType } from '@/types/api';

// ─── Schema ───────────────────────────────────────────────────────────────────

export const setSchema = z.object({
  id: z.string().optional(),
  label: z.string(),
  duration: z.string().min(1, 'Duration is required'),
  startTime: z.string(),
});

export const bookingFormSchema = z.object({
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

export type BookingFormValues = z.infer<typeof bookingFormSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  control: Control<BookingFormValues>;
  register: UseFormRegister<BookingFormValues>;
  errors: FieldErrors<BookingFormValues>;
  fields: FieldArrayWithId<BookingFormValues, 'sets'>[];
  onAppendSet: () => void;
  onRemoveSet: (index: number) => void;
}

export function BookingFormFields({
  control,
  register,
  errors,
  fields,
  onAppendSet,
  onRemoveSet,
}: Props) {
  return (
    <div className="space-y-6">
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
            onClick={onAppendSet}
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
                onClick={() => onRemoveSet(index)}
                className="text-muted hover:text-foreground transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Label (optional)</Label>
                <Input
                  placeholder="e.g. Ceremony"
                  {...register(`sets.${index}.label`)}
                />
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
        <Textarea
          rows={3}
          placeholder="Any notes about this booking..."
          {...register('notes')}
        />
      </div>
    </div>
  );
}
