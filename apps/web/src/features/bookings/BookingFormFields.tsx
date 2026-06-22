import { Controller } from 'react-hook-form';
import type { Control, UseFormRegister, FieldErrors } from 'react-hook-form';
import { z } from 'zod';
import { ChevronUp, ChevronDown, Music, Check } from 'lucide-react';
import { PACKAGE_ICON_MAP } from '@/lib/constants';
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
import { OverviewFields, type OverviewFieldsValue } from './OverviewFields';
import type { BookingSeries, PackageTemplate } from '@/types/api';

// ─── Schema ───────────────────────────────────────────────────────────────────

export const bookingFormSchema = z.object({
  // Overview bubbles the booking's identity (event type, date, fee, title, series) from the
  // shared atom core (ADR-0053). Series flows to the atomic POST via seriesId / newSeries.
  overview: z
    .custom<OverviewFieldsValue>()
    .refine((o) => !!o && o.date.trim().length > 0, { message: 'Date is required' }),
  status: z.enum(['ENQUIRY', 'PROVISIONAL', 'CONFIRMED', 'READY', 'COMPLETE', 'CANCELLED'] as const),
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
      {/* Overview — booking identity (event type, date, fee, title, series) from the shared
          Overview atom core (ADR-0053). Section chrome mirrors the Builder's BuilderSection. */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">Overview</h2>
        <div className="rounded-lg border border-border bg-background p-4">
          <Controller
            name="overview"
            control={control}
            render={({ field }) => (
              <OverviewFields
                value={field.value}
                onChange={field.onChange}
                series={(series ?? []).map((s) => ({ id: s.id, label: s.label }))}
                dateError={errors.overview?.message}
              />
            )}
          />
        </div>
      </section>

      {/* Status — stays a standalone, create-shell-owned control (not an Overview field);
          slice #545 reworks this into the coaching control. */}
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
