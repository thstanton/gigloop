import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { FormField } from '@/components/common/FormField';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EVENT_TYPE_LABELS } from '@/lib/constants';
import type { EventType } from '@/types/api';

// PRD #511 Module B — the Overview atom: the booking's identity (event type, date, fee, title).
// Status is deliberately NOT here — the status transition stays a standalone action with its
// confirmation dialog (rendered in the strip), never folded into a field.
//
// Like the Venue/People/Details atoms it is Sheet-agnostic and owns no mutation: it surfaces the
// changed fields via `onSave(changes)` and renders its Tier-1 save state from props. These are the
// booking's own scalar columns, so the host save is a plain PATCH of the changed fields — no JSON
// merge seam (unlike Details). Date is edited as a date-only value (the event time-of-day lives in
// the logistics anchors, not booking.date — matching the existing edit path).

/** Only the fields the user actually changed, so the host PATCHes the minimum. */
export interface OverviewChanges {
  eventType?: EventType;
  date?: string;
  fee?: number | null;
  title?: string | null;
}

interface OverviewAtomProps {
  initialEventType: EventType;
  /** Date-only (YYYY-MM-DD). */
  initialDate: string;
  /** Decimal string (e.g. "2500") or null when unset. */
  initialFee: string | null;
  initialTitle: string | null;
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

  const normalizedFee = feeStringToNumber(fee);
  const initialNormalizedFee = feeStringToNumber(initialFee ?? '');
  const normalizedTitle = title.trim() === '' ? null : title.trim();
  const initialNormalizedTitle = initialTitle ?? null;

  const changes: OverviewChanges = {};
  if (eventType !== initialEventType) changes.eventType = eventType;
  if (date !== initialDate) changes.date = date;
  if (normalizedFee !== initialNormalizedFee) changes.fee = normalizedFee;
  if (normalizedTitle !== initialNormalizedTitle) changes.title = normalizedTitle;
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
