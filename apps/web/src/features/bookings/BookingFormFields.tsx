import { Controller } from 'react-hook-form';
import type { Control, UseFormRegister, FieldErrors } from 'react-hook-form';
import { z } from 'zod';
import { ChevronUp, ChevronDown, Heart, GlassWater, Utensils, Moon, Briefcase, Music, Music2, Check } from 'lucide-react';
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
import type { EventType, PerformanceFormat } from '@/types/api';

// ─── Schema ───────────────────────────────────────────────────────────────────

export const bookingFormSchema = z.object({
  eventType: z.enum([
    'WEDDING', 'CORPORATE', 'PRIVATE', 'RESIDENCY', 'FESTIVAL', 'OUTDOOR', 'FUNCTION', 'OTHER',
  ] as const),
  date: z.string().min(1, 'Date is required'),
  status: z.enum(['ENQUIRY', 'CONFIRMED', 'INVOICED', 'SETTLED', 'COMPLETED', 'CANCELLED'] as const),
  title: z.string(),
  fee: z.string(),
  notes: z.string(),
  customerId: z.string().min(1, 'Customer is required'),
  venueId: z.string().nullable(),
  referrerId: z.string().nullable(),
  formatIds: z.array(z.string()),
});

export type BookingFormValues = z.infer<typeof bookingFormSchema>;

// ─── Icon map ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  heart: Heart,
  'glass-water': GlassWater,
  utensils: Utensils,
  moon: Moon,
  briefcase: Briefcase,
  music: Music,
  'music-2': Music2,
};

function FormatIcon({ icon, size = 16 }: { icon: string; size?: number }) {
  const Icon = ICON_MAP[icon] ?? Music;
  return <Icon size={size} />;
}

// ─── Format selector ──────────────────────────────────────────────────────────

function FormatSelector({
  formats,
  value,
  onChange,
}: {
  formats: PerformanceFormat[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  }

  function move(id: string, direction: 'up' | 'down') {
    const idx = value.indexOf(id);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === value.length - 1) return;
    const next = [...value];
    const swap = direction === 'up' ? idx - 1 : idx + 1;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onChange(next);
  }

  const selected = value
    .map((id) => formats.find((f) => f.id === id))
    .filter((f): f is PerformanceFormat => f !== undefined);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {formats.map((fmt) => {
          const active = value.includes(fmt.id);
          return (
            <button
              key={fmt.id}
              type="button"
              onClick={() => toggle(fmt.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-border hover:border-primary'
              }`}
            >
              <FormatIcon icon={fmt.icon} size={14} />
              {fmt.label}
              {active && <Check size={12} />}
            </button>
          );
        })}
      </div>

      {selected.length > 0 && (
        <div className="space-y-1">
          {selected.map((fmt, idx) => (
            <div key={fmt.id} className="flex items-center gap-2 px-3 py-2 border border-border rounded-md">
              <FormatIcon icon={fmt.icon} size={14} />
              <span className="flex-1 text-sm">{fmt.label}</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => move(fmt.id, 'up')}
                  className="text-muted hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  disabled={idx === selected.length - 1}
                  onClick={() => move(fmt.id, 'down')}
                  className="text-muted hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  control: Control<BookingFormValues>;
  register: UseFormRegister<BookingFormValues>;
  errors: FieldErrors<BookingFormValues>;
  songRequestFormEnabled?: boolean;
  formats?: PerformanceFormat[];
}

export function BookingFormFields({
  control,
  register,
  errors,
  songRequestFormEnabled,
  formats,
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

      {/* Performance formats */}
      {songRequestFormEnabled && formats && formats.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Performance formats</h2>
          <Controller
            name="formatIds"
            control={control}
            render={({ field }) => (
              <FormatSelector
                formats={formats}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>
      )}

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
