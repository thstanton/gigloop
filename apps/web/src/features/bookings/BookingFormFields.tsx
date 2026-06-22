import { Controller } from 'react-hook-form';
import type { Control, UseFormRegister, FieldErrors } from 'react-hook-form';
import { z } from 'zod';
import { ChevronUp, ChevronDown, Music, Check } from 'lucide-react';
import { PACKAGE_ICON_MAP } from '@/lib/constants';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Textarea } from '@/components/ui/textarea';
import { TogglePill } from '@/components/ui/toggle-pill';
import { Switch } from '@/components/ui/switch';
import { FormField } from '@/components/common/FormField';
import { IconButton } from '@/components/common/IconButton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RoleField, type RoleSelection } from './PeopleFields';
import { VenueFields, type VenueSelection } from './VenueFields';
import { EVENT_TYPE_LABELS } from '@/lib/constants';
import type { BookingSeries, EventType, PackageTemplate } from '@/types/api';

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
  // People + Venue bubble an existing-or-new selection from the shared atom cores (ADR-0053);
  // the create shell resolves a `new` selection to an id (eager POST /contacts) at submit.
  customer: z
    .custom<RoleSelection>()
    .refine(
      (s) => (s && s.kind === 'new' ? s.contact.name.trim().length > 0 : !!s && s.contactId != null),
      { message: 'Customer is required' },
    ),
  bookingAgent: z.custom<RoleSelection>(),
  venue: z.custom<VenueSelection>(),
  packageTemplateIds: z.array(z.string()),
  enableMusicForm: z.boolean(),
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
  formats: PackageTemplate[];
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
    .filter((f): f is PackageTemplate => f !== undefined);

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
  formats?: PackageTemplate[];
  series?: BookingSeries[];
}

export function BookingFormFields({
  control,
  register,
  errors,
  songRequestFormEnabled,
  formats,
  series,
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

      {/* People — consolidated customer + booking agent, from the shared People atom core
          (ADR-0053). Section chrome (header + bordered container) mirrors the Builder's
          BuilderSection so the two surfaces look identical. Create-mode regime: each role
          bubbles its existing-or-new selection up; the shell resolves a `new` selection to an
          id at submit. */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">People</h2>
        <div className="rounded-lg border border-border bg-background p-4 space-y-4">
          <Controller
            name="customer"
            control={control}
            render={({ field }) => (
              <RoleField
                label="Customer"
                preferredRole="CUSTOMER"
                required
                variant="customer"
                initialContactId={field.value.kind === 'existing' ? field.value.contactId : null}
                initialMode={
                  field.value.kind === 'existing' && field.value.contactId ? 'existing' : 'new'
                }
                error={errors.customer?.message}
                onChange={field.onChange}
              />
            )}
          />

          <Controller
            name="bookingAgent"
            control={control}
            render={({ field }) => (
              <RoleField
                label="Booking agent"
                preferredRole="BOOKING_AGENT"
                required={false}
                variant="agent"
                initialContactId={field.value.kind === 'existing' ? field.value.contactId : null}
                onChange={field.onChange}
              />
            )}
          />
        </div>
      </section>

      {/* Venue — its own section, same Builder chrome. VenueFields renders its own
          "Venue (optional)" sub-header inside the container, mirroring the Builder. */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">Venue</h2>
        <div className="rounded-lg border border-border bg-background p-4">
          <Controller
            name="venue"
            control={control}
            render={({ field }) => (
              <VenueFields
                initialVenueId={field.value.kind === 'existing' ? field.value.venueId : null}
                onChange={field.onChange}
              />
            )}
          />
        </div>
      </section>

      {/* Packages */}
      {songRequestFormEnabled && formats && formats.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Packages</h2>
          <Controller
            name="packageTemplateIds"
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

      {/* Music form — presence of a config row is the on/off truth (ADR-0046); this toggle
          decides whether one is created on booking creation, seeded from the chosen packages. */}
      {songRequestFormEnabled && (
        <Controller
          name="enableMusicForm"
          control={control}
          render={({ field }) => (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Music form</p>
                <p className="text-sm text-muted">Collect song requests from the customer for this booking.</p>
              </div>
              <Switch
                aria-label="Music form"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </div>
          )}
        />
      )}

      {/* Series — assignment lives in the Overview atom post-creation. */}
      <SeriesSection control={control} register={register} series={series} />

      {/* Notes */}
      <FormField label="Notes (optional)">
        <Textarea
          rows={3}
          placeholder="Any notes about this booking..."
          {...register('notes')}
        />
      </FormField>
    </div>
  );
}
