import { useState } from 'react';
import { IconPicker } from '@/components/common/IconPicker';
import { PACKAGE_CATEGORY_LABELS } from '@/lib/constants';
import type { PackageTemplate, SlotInput } from '@/types/api';

// ─── Form value shape + conversions ──────────────────────────────────────────
// PackageForm is presentational and fully controlled: the container owns the value and
// receives partial patches. These helpers convert to/from the API's PackageTemplate so both
// the admin drawer and (later) the onboarding step share one shape.

export type SlotDraft = SlotInput & { key: string };

export interface PackageFormValues {
  label: string;
  icon: string;
  category: string;
  notes: string;
  keyMoments: string[];
  defaultGenreSelection: string[];
  slots: SlotDraft[];
}

export function emptyPackageFormValues(): PackageFormValues {
  return { label: '', icon: 'music', category: '', notes: '', keyMoments: [], defaultGenreSelection: [], slots: [] };
}

export function packageToFormValues(pkg: PackageTemplate): PackageFormValues {
  return {
    label: pkg.label ?? '',
    icon: pkg.icon ?? 'music',
    category: pkg.category ?? '',
    notes: pkg.notes ?? '',
    keyMoments: pkg.keyMoments ?? [],
    defaultGenreSelection: pkg.defaultGenreSelection ?? [],
    slots: pkg.slots.map((s) => ({ ...s, label: s.label ?? undefined, key: s.id })),
  };
}

// The create/update payload (both endpoints share this shape).
export function packageFormToPayload(v: PackageFormValues) {
  return {
    label: v.label.trim(),
    icon: v.icon,
    category: v.category || undefined,
    notes: v.notes.trim() || undefined,
    keyMoments: v.keyMoments,
    defaultGenreSelection: v.defaultGenreSelection,
    slots: v.slots.map((s, i) => ({
      id: s.id,
      label: s.label?.trim() || undefined,
      duration: s.duration,
      order: i,
    })),
  };
}

const CATEGORY_OPTIONS = [
  { value: '', label: 'Uncategorised' },
  ...Object.entries(PACKAGE_CATEGORY_LABELS).map(([v, l]) => ({ value: v, label: l })),
];

// Optional per-field helper text. Default undefined → no helper text renders, so the admin drawer
// (which passes no hints) is unchanged; onboarding passes purpose-helper copy under each field.
export interface PackageFormHints {
  label?: string;
  category?: string;
  notes?: string;
  keyMoments?: string;
  defaultGenreSelection?: string;
  slots?: string;
}

function FieldHint({ text }: { text?: string }) {
  if (!text) return null;
  return <p className="-mt-0.5 mb-1.5 text-xs text-muted">{text}</p>;
}

// ─── Tag input ────────────────────────────────────────────────────────────────

function TagInput({
  label,
  tags,
  onChange,
  hint,
}: {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  hint?: string;
}) {
  const [input, setInput] = useState('');

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      if (!tags.includes(input.trim())) onChange([...tags, input.trim()]);
      setInput('');
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">{label}</label>
      <FieldHint text={hint} />
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 bg-surface border border-border rounded px-2 py-0.5 text-sm"
          >
            {t}
            <button
              type="button"
              onClick={() => onChange(tags.filter((x) => x !== t))}
              className="text-muted hover:text-foreground leading-none"
              aria-label={`Remove ${t}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Type and press Enter"
        className="w-full border border-border rounded px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}

// ─── Set list editor ──────────────────────────────────────────────────────────

function SlotEditor({
  slots,
  onChange,
  hint,
}: {
  slots: SlotDraft[];
  onChange: (slots: SlotDraft[]) => void;
  hint?: string;
}) {
  function move(index: number, dir: -1 | 1) {
    const next = [...slots];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next.map((s, i) => ({ ...s, order: i })));
  }

  function update(index: number, field: 'label' | 'duration', value: string) {
    const next = [...slots];
    if (field === 'duration') {
      next[index] = { ...next[index], duration: parseInt(value, 10) || 1 };
    } else {
      next[index] = { ...next[index], label: value };
    }
    onChange(next);
  }

  function remove(index: number) {
    onChange(slots.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i })));
  }

  function add() {
    onChange([...slots, { key: crypto.randomUUID(), duration: 60, order: slots.length }]);
  }

  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">Sets</label>
      <FieldHint text={hint} />
      <div className="space-y-2">
        {slots.map((slot, i) => (
          <div key={slot.key} className="flex items-center gap-2">
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="text-muted hover:text-foreground disabled:opacity-30 leading-none text-xs"
                aria-label="Move up"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === slots.length - 1}
                className="text-muted hover:text-foreground disabled:opacity-30 leading-none text-xs"
                aria-label="Move down"
              >
                ▼
              </button>
            </div>
            <input
              type="text"
              value={slot.label ?? ''}
              onChange={(e) => update(i, 'label', e.target.value)}
              placeholder="Label"
              className="flex-1 border border-border rounded px-2 py-1.5 text-sm bg-background text-foreground min-w-0"
            />
            <input
              type="number"
              value={slot.duration}
              min={1}
              onChange={(e) => update(i, 'duration', e.target.value)}
              className="w-16 border border-border rounded px-2 py-1.5 text-sm bg-background text-foreground"
              aria-label="Duration (min)"
            />
            <span className="text-sm text-muted flex-shrink-0">min</span>
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-muted hover:text-status-cancelled flex-shrink-0"
              aria-label="Remove set"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={add} className="mt-2 text-sm text-primary hover:underline">
        + Add set
      </button>
    </div>
  );
}

// ─── Package form ─────────────────────────────────────────────────────────────

/**
 * Presentational package-template editor (#662). Renders standalone (onboarding, a later slice)
 * or inside the admin Sheet. Fully controlled: the container owns `value` and applies the
 * partial patches emitted by `onChange`. It renders only the fields — no title, save button, or
 * mutations (those belong to the container).
 */
export function PackageForm({
  value,
  onChange,
  hints,
}: {
  value: PackageFormValues;
  onChange: (patch: Partial<PackageFormValues>) => void;
  hints?: PackageFormHints;
}) {
  return (
    <div className="space-y-5">
      {/* Label */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Label</label>
        <FieldHint text={hints?.label} />
        <input
          type="text"
          value={value.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="w-full border border-border rounded px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Package name"
        />
      </div>

      {/* Icon */}
      <IconPicker value={value.icon} onChange={(icon) => onChange({ icon })} />

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Category</label>
        <FieldHint text={hints?.category} />
        <select
          value={value.category}
          onChange={(e) => onChange({ category: e.target.value })}
          className="w-full border border-border rounded px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Sets */}
      <SlotEditor slots={value.slots} onChange={(slots) => onChange({ slots })} hint={hints?.slots} />

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
        <FieldHint text={hints?.notes} />
        <textarea
          value={value.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          rows={2}
          className="w-full border border-border rounded px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          placeholder="Optional notes"
        />
      </div>

      {/* Special requests (the keyMoments field — relabelled from "Key moments" for consistency
          with PackageMusicSummary and the live music form; #662) */}
      <TagInput label="Special requests" tags={value.keyMoments} onChange={(keyMoments) => onChange({ keyMoments })} hint={hints?.keyMoments} />

      {/* Genre selection */}
      <TagInput
        label="Default genre selection"
        tags={value.defaultGenreSelection}
        onChange={(defaultGenreSelection) => onChange({ defaultGenreSelection })}
        hint={hints?.defaultGenreSelection}
      />
    </div>
  );
}
