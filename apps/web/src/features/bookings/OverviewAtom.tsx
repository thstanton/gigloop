import { useState } from 'react';
import { Button } from '@/components/ui/button';
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

// PRD #511 Module B — the Overview atom: the booking's identity (event type, date, fee, title,
// and series assignment). Status is deliberately NOT here — the status transition stays a
// standalone action with its confirmation dialog (rendered in the strip), never folded into a
// field. Series assignment is the one field that takes a separate API path — surfaced via
// `onSave(changes)` like the others; the shell owns the `PATCH /bookings/:id/series` call,
// the `requiresConfirmation` confirmation flow, and the ConflictException error display.

type SeriesMode = 'none' | 'existing' | 'new';

/** The series change the atom detected — included in changes only when series actually changed. */
export type SeriesChange =
  | { mode: 'none' }
  | { mode: 'existing'; seriesId: string }
  | { mode: 'new'; label: string };

/** Only the fields the user actually changed, so the host PATCHes the minimum. */
export interface OverviewChanges {
  eventType?: EventType;
  date?: string;
  fee?: number | null;
  title?: string | null;
  series?: SeriesChange;
}

interface OverviewAtomProps {
  initialEventType: EventType;
  /** Date-only (YYYY-MM-DD). */
  initialDate: string;
  /** Decimal string (e.g. "2500") or null when unset. */
  initialFee: string | null;
  initialTitle: string | null;
  /** Current series assignment; null when the booking is not in any series. */
  initialSeriesId: string | null;
  /** Available series to pick from in 'existing' mode. */
  series: Array<{ id: string; label: string }>;
  onSave: (changes: OverviewChanges) => void;
  // Tier-1 save state, injected by the host.
  isSaving: boolean;
  saved: boolean;
  saveError: string | null;
}

function feeStringToNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = parseFloat(trimmed);
  return Number.isNaN(n) ? null : n;
}

export function OverviewAtom({
  initialEventType,
  initialDate,
  initialFee,
  initialTitle,
  initialSeriesId,
  series,
  onSave,
  isSaving,
  saved,
  saveError,
}: OverviewAtomProps) {
  // Self-initialized once (Venue/People/Details style): the post-save ['booking'] refetch must not
  // stomp an in-progress edit while the self-saving shell stays open.
  const [eventType, setEventType] = useState<EventType>(initialEventType);
  const [date, setDate] = useState(initialDate);
  const [fee, setFee] = useState(initialFee ?? '');
  const [title, setTitle] = useState(initialTitle ?? '');

  const initialSeriesMode: SeriesMode = initialSeriesId ? 'existing' : 'none';
  const [seriesMode, setSeriesMode] = useState<SeriesMode>(initialSeriesMode);
  const [seriesId, setSeriesId] = useState<string | null>(initialSeriesId);
  const [newSeriesLabel, setNewSeriesLabel] = useState('');

  const normalizedFee = feeStringToNumber(fee);
  const initialNormalizedFee = feeStringToNumber(initialFee ?? '');
  const normalizedTitle = title.trim() === '' ? null : title.trim();
  const initialNormalizedTitle = initialTitle ?? null;

  const changes: OverviewChanges = {};
  if (eventType !== initialEventType) changes.eventType = eventType;
  if (date !== initialDate) changes.date = date;
  if (normalizedFee !== initialNormalizedFee) changes.fee = normalizedFee;
  if (normalizedTitle !== initialNormalizedTitle) changes.title = normalizedTitle;

  // Series dirty detection: only include a series change when the assignment actually differs.
  if (seriesMode === 'none' && initialSeriesId !== null) {
    changes.series = { mode: 'none' };
  } else if (seriesMode === 'existing' && seriesId && seriesId !== initialSeriesId) {
    changes.series = { mode: 'existing', seriesId };
  } else if (seriesMode === 'new' && newSeriesLabel.trim()) {
    changes.series = { mode: 'new', label: newSeriesLabel.trim() };
  }

  const dirty = Object.keys(changes).length > 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Event type">
          <Select value={eventType} onValueChange={(v) => setEventType(v as EventType)}>
            <SelectTrigger aria-label="Event type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(EVENT_TYPE_LABELS) as [EventType, string][]).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Date">
          <DatePicker value={date} onChange={setDate} />
        </FormField>
      </div>

      <FormField label="Fee (optional)">
        <Input
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          aria-label="Fee"
          value={fee}
          onChange={(e) => setFee(e.target.value)}
        />
      </FormField>

      <FormField label="Title (optional)">
        <Input
          placeholder="e.g. Smith Wedding"
          aria-label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </FormField>

      {/* Series assignment — none / existing / new toggle. */}
      <div className="space-y-3">
        <p className="text-sm font-medium leading-none">Series (optional)</p>
        <div className="flex flex-wrap gap-2">
          {(['none', 'existing', 'new'] as const).map((mode) => (
            <TogglePill
              key={mode}
              active={seriesMode === mode}
              onClick={() => {
                setSeriesMode(mode);
                if (mode === 'existing') setSeriesId(initialSeriesId);
                if (mode === 'new') setNewSeriesLabel('');
              }}
            >
              {{ none: 'None', existing: 'Existing series', new: 'New series' }[mode]}
            </TogglePill>
          ))}
        </div>
        {seriesMode === 'existing' && (
          series.length > 0 ? (
            <Select value={seriesId ?? ''} onValueChange={setSeriesId}>
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
        {seriesMode === 'new' && (
          <FormField label="Series label">
            <Input
              placeholder="e.g. Hotel Intercontinental — May 2026"
              aria-label="Series label"
              value={newSeriesLabel}
              onChange={(e) => setNewSeriesLabel(e.target.value)}
            />
          </FormField>
        )}
      </div>

      {/* Tier-1 inline save (CLAUDE.md Loading & Feedback): disabled + "Saving…" while pending,
          inline "Saved" on success, inline error below the action. */}
      <div className="flex items-center gap-3 pt-1">
        <Button type="button" onClick={() => onSave(changes)} disabled={isSaving || !dirty}>
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
        {saved && !isSaving && <span className="text-xs text-muted">Saved</span>}
        {saveError && <p className="text-sm text-status-cancelled">{saveError}</p>}
      </div>
    </div>
  );
}
