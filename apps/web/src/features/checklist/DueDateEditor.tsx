import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DueDateRule } from '@/types/api';

// Human-readable summary of a goal/custom due-date rule, shown on the collapsed trigger.
export function formatDueDateRule(rule: DueDateRule | null): string {
  if (!rule) return 'No due date';
  const days = Math.abs(rule.offsetDays);
  const basis = rule.basis === 'bookingDate' ? 'the booking date' : 'the booking was created';
  if (rule.offsetDays === 0) {
    return rule.basis === 'bookingDate' ? 'On the booking date' : 'When the booking is created';
  }
  const direction = rule.offsetDays < 0 ? 'before' : 'after';
  return `${days} day${days !== 1 ? 's' : ''} ${direction} ${basis}`;
}

type Basis = 'bookingDate' | 'bookingCreation';
type Direction = 'before' | 'after';

// The editing controls, seeded from the current rule. Split from the open/closed wrapper so each stays
// small and focused. Submits a rule (or null for "no date"); the wrapper closes on either.
function DueDateForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: DueDateRule | null;
  onSubmit: (rule: DueDateRule | null) => void;
  onCancel: () => void;
}) {
  const [days, setDays] = useState(initial ? Math.abs(initial.offsetDays).toString() : '14');
  const [direction, setDirection] = useState<Direction>(initial && initial.offsetDays < 0 ? 'before' : 'after');
  const [basis, setBasis] = useState<Basis>(initial?.basis ?? 'bookingDate');

  // The booking-created anchor is after-only — a reminder can't predate the record.
  const beforeAllowed = basis === 'bookingDate';
  const effectiveDir: Direction = beforeAllowed ? direction : 'after';

  const submit = () => {
    const abs = Math.abs(Number(days)) || 0;
    onSubmit({ basis, offsetDays: effectiveDir === 'before' ? -abs : abs });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        type="number"
        min={0}
        value={days}
        onChange={(e) => setDays(e.target.value)}
        className="w-14 text-xs border border-border rounded px-2 py-1 bg-background"
        placeholder="14"
        aria-label="Days"
      />
      <span className="text-xs text-muted">days</span>
      <select
        value={effectiveDir}
        disabled={!beforeAllowed}
        onChange={(e) => setDirection(e.target.value as Direction)}
        className="text-xs border border-border rounded px-2 py-1 bg-background disabled:opacity-60"
        aria-label="Direction"
      >
        {beforeAllowed && <option value="before">before</option>}
        <option value="after">after</option>
      </select>
      <select
        value={basis}
        onChange={(e) => setBasis(e.target.value as Basis)}
        className="text-xs border border-border rounded px-2 py-1 bg-background"
        aria-label="Anchor"
      >
        <option value="bookingDate">the booking date</option>
        <option value="bookingCreation">booking created</option>
      </select>
      <Button type="button" size="sm" variant="outline" className="text-xs h-7" onClick={submit}>
        Save
      </Button>
      <Button type="button" size="sm" variant="ghost" className="text-xs h-7" onClick={() => onSubmit(null)}>
        No date
      </Button>
      <Button type="button" size="sm" variant="ghost" className="text-xs h-7" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

/**
 * The goal-level due-date control (#718). Keeps full flexibility — both anchors (booking date / booking
 * created) × both directions (before / after) — with one guard: a reminder cannot fall *before* the
 * booking record exists, so `bookingCreation` is after-only. The write DTO enforces the same as a
 * backstop. Shows the formatted rule as a trigger, expands to the editing form, commits via `onChange`.
 */
export function DueDateEditor({
  value,
  onChange,
  ariaLabel,
}: {
  value: DueDateRule | null;
  onChange: (rule: DueDateRule | null) => void;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <DueDateForm
        initial={value}
        onSubmit={(rule) => {
          onChange(rule);
          setOpen(false);
        }}
        onCancel={() => setOpen(false)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={ariaLabel ? `Edit due date for ${ariaLabel}` : 'Edit due date'}
      className="flex items-center gap-1 text-xs text-primary hover:underline"
    >
      {formatDueDateRule(value)}
      <Pencil size={11} aria-hidden="true" />
    </button>
  );
}
