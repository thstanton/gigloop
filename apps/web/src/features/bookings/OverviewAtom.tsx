import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { OverviewFields, type OverviewFieldsValue } from './OverviewFields';
import type { EventType } from '@/types/api';

// PRD #511 Module B — the Overview atom: composes the shared OverviewFields core (the booking's
// identity: event type, date, fee, title, series assignment) with a Tier-1 save row, owning the
// diff (only-changed-fields) and the orchestrated save. Status is deliberately NOT here — the
// status transition stays a standalone action with its confirmation dialog (rendered in the
// strip), never folded into a field. Series assignment is the one field that takes a separate
// API path — surfaced via `onSave(changes)` like the others; the shell owns the
// `PATCH /bookings/:id/series` call, the `requiresConfirmation` confirmation flow, and the
// ConflictException error display.

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
  const [value, setValue] = useState<OverviewFieldsValue>({
    eventType: initialEventType,
    date: initialDate,
    fee: initialFee ?? '',
    title: initialTitle ?? '',
    seriesMode: initialSeriesId ? 'existing' : 'none',
    seriesId: initialSeriesId,
    newSeriesLabel: '',
  });

  const normalizedFee = feeStringToNumber(value.fee);
  const initialNormalizedFee = feeStringToNumber(initialFee ?? '');
  const normalizedTitle = value.title.trim() === '' ? null : value.title.trim();
  const initialNormalizedTitle = initialTitle ?? null;

  const changes: OverviewChanges = {};
  if (value.eventType !== initialEventType) changes.eventType = value.eventType;
  if (value.date !== initialDate) changes.date = value.date;
  if (normalizedFee !== initialNormalizedFee) changes.fee = normalizedFee;
  if (normalizedTitle !== initialNormalizedTitle) changes.title = normalizedTitle;

  // Series dirty detection: only include a series change when the assignment actually differs.
  if (value.seriesMode === 'none' && initialSeriesId !== null) {
    changes.series = { mode: 'none' };
  } else if (value.seriesMode === 'existing' && value.seriesId && value.seriesId !== initialSeriesId) {
    changes.series = { mode: 'existing', seriesId: value.seriesId };
  } else if (value.seriesMode === 'new' && value.newSeriesLabel.trim()) {
    changes.series = { mode: 'new', label: value.newSeriesLabel.trim() };
  }

  const dirty = Object.keys(changes).length > 0;

  return (
    <div className="space-y-5">
      <OverviewFields value={value} onChange={setValue} series={series} />

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
