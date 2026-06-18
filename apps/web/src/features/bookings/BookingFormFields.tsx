import { Controller } from 'react-hook-form';
import type { Control, UseFormRegister, FieldErrors } from 'react-hook-form';
import { z } from 'zod';
import { ChevronUp, ChevronDown, Music, Check } from 'lucide-react';
import { PACKAGE_ICON_MAP } from '@/lib/constants';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Textarea } from '@/components/ui/textarea';
import { TogglePill } from '@/components/ui/toggle-pill';
import { FormField } from '@/components/common/FormField';
import { IconButton } from '@/components/common/IconButton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { InlineContactBlock } from './InlineContactBlock';
import { InlineVenueBlock } from './InlineVenueBlock';
import { InlineAgentBlock } from './InlineAgentBlock';
import { EVENT_TYPE_LABELS } from '@/lib/constants';
import type { BookingSeries, EventType, Package } from '@/types/api';

// ─── Schema ───────────────────────────────────────────────────────────────────

export const bookingFormSchema = z.object({
  eventType: z.enum([
    'WEDDING', 'CORPORATE', 'PRIVATE', 'RESIDENCY', 'FESTIVAL', 'OUTDOOR', 'FUNCTION', 'OTHER',
  ] as const),
  date: z.string().min(1, 'Date is required'),
  status: z.enum(['ENQUIRY', 'PROVISIONAL', 'CONFIRMED', 'READY', 'COMPLETE', 'CANCELLED'] as const),
  title: z.string(),
  fee: z.string(),
  notes: z.string(),
  customerId: z.string().min(1, 'Customer is required'),
  venueId: z.string().nullable(),
  bookingAgentId: z.string().nullable(),
  formatIds: z.array(z.string()),
  seriesMode: z.enum(['none', 'existing', 'new']),
  seriesId: z.string().nullable().optional(),
  newSeriesLabel: z.string().optional(),
});

export type BookingFormValues = z.infer<typeof bookingFormSchema>;

function FormatIcon({ icon, size = 16 }: { icon: string; size?: number }) {
  const Icon = PACKAGE_ICON_MAP[icon] ?? Music;
  return <Icon size={size} />;
}

// ─── Format selector ──────────────────────────────────────────────────────────

function FormatSelector({
  formats,
  value,
  onChange,
}: {
  formats: Package[];
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
    .filter((f): f is Package => f !== undefined);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {formats.map((fmt) => {
          const active = value.includes(fmt.id);
          return (
            <TogglePill key={fmt.id} active={active} onClick={() => toggle(fmt.id)}>
              <FormatIcon icon={fmt.icon} size={14} />
              {fmt.label}
              {active && <Check size={12} />}
            </TogglePill>
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
                <IconButton
                  label={`Move ${fmt.label} up`}
                  disabled={idx === 0}
                  onClick={() => move(fmt.id, 'up')}
                >
                  <ChevronUp size={14} aria-hidden="true" />
                </IconButton>
                <IconButton
                  label={`Move ${fmt.label} down`}
                  disabled={idx === selected.length - 1}
                  onClick={() => move(fmt.id, 'down')}
                >
                  <ChevronDown size={14} aria-hidden="true" />
                </IconButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const SERIES_MODE_LABELS: Record<string, string> = {
  none: 'None',
  existing: 'Existing series',
  new: 'New series',
};

// ─── Series section ───────────────────────────────────────────────────────────

function SeriesSection({
  control,
  register,
  series,
}: {
  control: Control<BookingFormValues>;
  register: UseFormRegister<BookingFormValues>;
  series?: BookingSeries[];
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Series (optional)</h2>
      <Controller
        name="seriesMode"
        control={control}
        render={({ field }) => (
          <>
            <div className="flex gap-2">
              {(['none', 'existing', 'new'] as const).map((mode) => (
                <TogglePill
                  key={mode}
                  active={field.value === mode}
                  onClick={() => field.onChange(mode)}
                >
                  {SERIES_MODE_LABELS[mode]}
                </TogglePill>
              ))}
            </div>
            {field.value === 'existing' && series && series.length > 0 && (
              <Controller
                name="seriesId"
                control={control}
                render={({ field: seriesField }) => (
                  <Select value={seriesField.value ?? ''} onValueChange={seriesField.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select series..." />
                    </SelectTrigger>
                    <SelectContent>
                      {series.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
            {field.value === 'existing' && (!series || series.length === 0) && (
              <p className="text-sm text-muted">No series yet. Use "New series" to create one.</p>
            )}
            {field.value === 'new' && (
              <FormField label="Series label">
                <Input
                  placeholder="e.g. Hotel Intercontinental — May 2026"
                  {...register('newSeriesLabel')}
                />
              </FormField>
            )}
          </>
        )}
      />
    </div>
  );
}


// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  control: Control<BookingFormValues>;
  register: UseFormRegister<BookingFormValues>;
  errors: FieldErrors<BookingFormValues>;
  songRequestFormEnabled?: boolean;
  formats?: Package[];
  series?: BookingSeries[];
  hideNotes?: boolean;
  /** Hide the People section — the edit drawer renders its own People blocks that
   *  save independently (per-box), separate from this form's global Save. */
  hidePeople?: boolean;
}

export function BookingFormFields({
  control,
  register,
  errors,
  songRequestFormEnabled,
  formats,
  series,
  hideNotes,
  hidePeople,
}: Props) {
  return (
    <div className="space-y-6">
      {/* Event type + Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Event type">
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
        </FormField>

        <FormField label="Date" error={errors.date?.message}>
          <Controller
            name="date"
            control={control}
            render={({ field }) => (
              <DatePicker value={field.value} onChange={field.onChange} />
            )}
          />
        </FormField>
      </div>

      {/* Status + Fee */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Status">
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
                  <SelectItem value="PROVISIONAL">Provisional</SelectItem>
                  <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                  <SelectItem value="READY">Ready</SelectItem>
                  <SelectItem value="COMPLETE">Complete</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        <FormField label="Fee (optional)">
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            {...register('fee')}
          />
        </FormField>
      </div>

      {/* Title */}
      <FormField label="Title (optional)">
        <Input placeholder="e.g. Smith Wedding" {...register('title')} />
      </FormField>

      {/* People — only in the create form; the edit drawer renders its own
          per-box-saving People section (see BookingEditDrawer). */}
      {!hidePeople && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">People</h2>

          <Controller
            name="customerId"
            control={control}
            render={({ field }) => (
              <InlineContactBlock
                value={field.value || null}
                onChange={(id) => field.onChange(id ?? '')}
                error={errors.customerId?.message}
              />
            )}
          />

          <Controller
            name="venueId"
            control={control}
            render={({ field }) => (
              <InlineVenueBlock
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />

          <Controller
            name="bookingAgentId"
            control={control}
            render={({ field }) => (
              <InlineAgentBlock
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>
      )}

      {/* Packages */}
      {songRequestFormEnabled && formats && formats.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Packages</h2>
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

      {/* Series */}
      <SeriesSection control={control} register={register} series={series} />

      {/* Notes — hidden when managed by inline auto-save on the detail page */}
      {!hideNotes && (
        <FormField label="Notes (optional)">
          <Textarea
            rows={3}
            placeholder="Any notes about this booking..."
            {...register('notes')}
          />
        </FormField>
      )}
    </div>
  );
}
