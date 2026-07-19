import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { FormField } from '@/components/common/FormField';
import { TogglePill } from '@/components/ui/toggle-pill';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EVENT_TYPE_LABELS } from '@/lib/constants';
import type { EventType } from '@/types/api';

// PRD #511 Module B / ADR-0053 — the controlled presentational core for the Overview section
// (the booking's identity: event type, date, fee, title, and series assignment). Sibling to
// PeopleFields / VenueFields / DetailsFields: fully controlled (value in, onChange out), no
// save row, no diff logic. Two thin compositions consume it: the self-saving OverviewAtom
// (Builder + quick-tweak, which owns the diff + PATCH) and the New Booking form (create-mode,
// values bubble to the atomic POST). Status is deliberately NOT here — it stays a standalone
// shell-owned control, never a field.

export type SeriesMode = 'none' | 'existing' | 'new';

export interface OverviewFieldsValue {
  eventType: EventType;
  /** Date-only (YYYY-MM-DD). */
  date: string;
  /** Raw input string (e.g. "2500"); '' when unset. */
  fee: string;
  title: string;
  seriesMode: SeriesMode;
  seriesId: string | null;
  newSeriesLabel: string;
}

interface OverviewFieldsProps {
  value: OverviewFieldsValue;
  onChange: (next: OverviewFieldsValue) => void;
  /** Available series to pick from in 'existing' mode. */
  series: Array<{ id: string; label: string }>;
  /** Required-field error (date), rendered below the date input (used by the create form). */
  dateError?: string;
}

export function OverviewFields({ value, onChange, series, dateError }: OverviewFieldsProps) {
  const set = (patch: Partial<OverviewFieldsValue>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Event type">
          <Select value={value.eventType} onValueChange={(v) => set({ eventType: v as EventType })}>
            <SelectTrigger aria-label="Event type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(EVENT_TYPE_LABELS) as [EventType, string][]).map(([v, label]) => (
                <SelectItem key={v} value={v}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Date" error={dateError}>
          <DatePicker value={value.date} onChange={(date) => set({ date })} />
        </FormField>
      </div>

      <FormField label="Fee (optional)">
        <div className="relative">
          <span
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground"
            aria-hidden="true"
          >
            £
          </span>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            aria-label="Fee"
            value={value.fee}
            onChange={(e) => set({ fee: e.target.value })}
            className="pl-7"
          />
        </div>
      </FormField>

      <FormField label="Title (optional)">
        <Input
          placeholder="e.g. Smith Wedding"
          aria-label="Title"
          value={value.title}
          onChange={(e) => set({ title: e.target.value })}
        />
      </FormField>

      {/* Series assignment — none / existing / new toggle. */}
      <div className="space-y-3">
        <p className="text-sm font-medium leading-none">Series (optional)</p>
        <div className="flex flex-wrap gap-2">
          {(['none', 'existing', 'new'] as const).map((mode) => (
            <TogglePill
              key={mode}
              active={value.seriesMode === mode}
              onClick={() =>
                set({
                  seriesMode: mode,
                  ...(mode === 'new' ? { newSeriesLabel: '' } : {}),
                })
              }
            >
              {{ none: 'None', existing: 'Existing series', new: 'New series' }[mode]}
            </TogglePill>
          ))}
        </div>
        {value.seriesMode === 'existing' && (
          series.length > 0 ? (
            <Select value={value.seriesId ?? ''} onValueChange={(seriesId) => set({ seriesId })}>
              <SelectTrigger aria-label="Series">
                <SelectValue placeholder="Select series…" />
              </SelectTrigger>
              <SelectContent>
                {series.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted">No series yet. Use "New series" to create one.</p>
          )
        )}
        {value.seriesMode === 'new' && (
          <FormField label="Series label">
            <Input
              placeholder="e.g. Hotel Intercontinental — May 2026"
              aria-label="Series label"
              value={value.newSeriesLabel}
              onChange={(e) => set({ newSeriesLabel: e.target.value })}
            />
          </FormField>
        )}
      </div>
    </div>
  );
}
