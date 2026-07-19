import { useEffect, useRef, useState, type FocusEvent } from 'react';
import { Copy, Trash2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/common/FormField';
import { SubLabel } from '@/components/common/SubLabel';
import { PackageIcon } from '@/components/common/PackageIcon';
import { IconPicker } from '@/components/common/IconPicker';
import { LogisticsIconPicker } from './DetailsFields';
import {
  LOGISTICS_ANCHOR_FIELDS,
  LOGISTICS_FIELD_ICONS,
  type LogisticsAnchorKey,
} from '@/lib/constants';
import { cn } from '@/lib/utils';
import type {
  BookingLogisticsEntry,
  BookingPackageSummary,
  PackageTemplate,
  PerformanceSet,
} from '@/types/api';

// PRD #511 Module B — presentational row primitives for the Itinerary atom (slice #521).
// These own NO mutation and NO fetch: they render controlled state and signal intent via
// callbacks. The atom composes them; the host shell turns the callbacks into persistence.

// ─── The three operational time anchors (logistics JSON, ADR-0034) ──────────────


/** Local draft for one anchor — value (HH:MM), optional icon override, and free-text notes. */
export type AnchorEntry = { value: string; icon: string; notes: string };

export function anchorEntryFrom(
  logistics: Record<string, BookingLogisticsEntry> | null,
  key: LogisticsAnchorKey,
): AnchorEntry {
  const entry = logistics?.[key];
  return { value: entry?.value ?? '', icon: entry?.icon ?? '', notes: entry?.notes ?? '' };
}

/** Build the anchor slice to PATCH. Empty anchors drop out; share flags are preserved from the
 *  prior entry (the editor doesn't surface them — the read view doesn't either). */
export function buildAnchorSlice(
  draft: Record<LogisticsAnchorKey, AnchorEntry>,
  initial: Record<string, BookingLogisticsEntry> | null,
): Record<string, BookingLogisticsEntry> {
  const out: Record<string, BookingLogisticsEntry> = {};
  for (const { key } of LOGISTICS_ANCHOR_FIELDS) {
    const e = draft[key];
    if (!e.value) continue;
    const prev = initial?.[key];
    out[key] = {
      value: e.value,
      ...(e.icon && { icon: e.icon }),
      ...(e.notes && { notes: e.notes }),
      shareWithBand: prev?.shareWithBand ?? false,
      shareWithClient: prev?.shareWithClient ?? false,
    };
  }
  return out;
}

// ─── Time anchor row (label above, icon + time, notes below) ────────────────────

export function AnchorRow({
  anchorKey,
  label,
  entry,
  onChange,
}: {
  anchorKey: LogisticsAnchorKey;
  label: string;
  entry: AnchorEntry;
  onChange: (patch: Partial<AnchorEntry>) => void;
}) {
  return (
    <FormField label={label}>
      <div className="flex items-center gap-2">
        <LogisticsIconPicker
          value={entry.icon}
          defaultIcon={LOGISTICS_FIELD_ICONS[anchorKey] ?? 'clock'}
          onChange={(icon) => onChange({ icon })}
        />
        <Input
          type="time"
          aria-label={label}
          value={entry.value}
          onChange={(e) => onChange({ value: e.target.value })}
          className="min-w-0 flex-1"
        />
      </div>
      <Input
        aria-label={`${label} notes`}
        placeholder="Additional notes…"
        value={entry.notes}
        onChange={(e) => onChange({ notes: e.target.value })}
        className="mt-2"
      />
    </FormField>
  );
}

// ─── Set draft (the persistent add-set form's working values) ────────────────────

export type SetDraft = { label: string; duration: string; startTime: string };
export const emptySetDraft: SetDraft = { label: '', duration: '30', startTime: '' };

export type SetValues = { label: string | null; duration: number; startTime: string | null };

export function draftToValues(d: SetDraft): SetValues {
  return {
    label: d.label.trim() || null,
    duration: parseInt(d.duration, 10) || 1,
    startTime: d.startTime || null,
  };
}

/** Target options for the re-parent dropdown: every package plus "No package". */
export type PackageOption = { value: string; label: string };
export const NO_PACKAGE = '__none__';

// ─── Set row: collapsed summary that expands to an editor ────────────────────────

export function SetRow({
  set,
  packageOptions,
  isSaving,
  isDeleting,
  isMoving,
  onCommit,
  onMove,
  onCopy,
  onDelete,
}: {
  set: PerformanceSet;
  packageOptions: PackageOption[];
  isSaving: boolean;
  isDeleting: boolean;
  isMoving: boolean;
  onCommit: (values: SetValues) => void;
  onMove: (target: string) => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(set.label ?? '');
  const [duration, setDuration] = useState(set.duration.toString());
  const [startTime, setStartTime] = useState(set.startTime ?? '');
  const rowFocused = useRef(false);

  // Re-sync from server after an invalidation — but never mid-edit, or an in-flight save
  // resolving would clobber what the user just retyped (PerformanceEditor precedent).
  useEffect(() => {
    if (rowFocused.current) return;
    setLabel(set.label ?? '');
    setDuration(set.duration.toString());
    setStartTime(set.startTime ?? '');
  }, [set.label, set.duration, set.startTime]);

  // Save once when focus leaves the whole editor — not when tabbing between its fields.
  function handleEditorBlur(e: FocusEvent<HTMLDivElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    rowFocused.current = false;
    const dirty =
      (label.trim() || null) !== (set.label ?? null) ||
      (parseInt(duration, 10) || 0) !== set.duration ||
      (startTime || null) !== (set.startTime ?? null);
    if (dirty) onCommit(draftToValues({ label, duration, startTime }));
  }

  const currentTarget = set.packageId ?? NO_PACKAGE;

  return (
    <div className="rounded-md border border-border bg-background">
      <div className="flex items-center gap-2 px-2.5 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="w-12 flex-shrink-0 text-sm font-medium tabular-nums text-foreground">
            {set.startTime || '—'}
          </span>
          <span className="truncate text-sm text-foreground">{set.label || 'Untitled set'}</span>
          <span className="ml-auto flex-shrink-0 text-xs text-muted">{set.duration}m</span>
        </button>
        <button type="button" onClick={onCopy} aria-label="Copy set" className="p-1 text-muted transition-colors hover:text-primary">
          <Copy size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          aria-label="Remove set"
          className="p-1 text-muted transition-colors hover:text-status-cancelled disabled:opacity-50"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      {open && (
        <div className="space-y-2 border-t border-border p-2.5" onFocus={() => { rowFocused.current = true; }} onBlur={handleEditorBlur}>
          <FieldStack label="Label">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Ceremony" aria-label="Set label" />
          </FieldStack>
          <div className="grid grid-cols-2 gap-2">
            <FieldStack label="Minutes">
              <Input type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} aria-label="Duration in minutes" />
            </FieldStack>
            <FieldStack label="Start">
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} aria-label="Start time" />
            </FieldStack>
          </div>
          <FieldStack label="Package">
            <select
              value={currentTarget}
              onChange={(e) => onMove(e.target.value)}
              disabled={isMoving}
              aria-label="Package"
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            >
              {packageOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </FieldStack>
          {isSaving && <p className="text-xs text-muted">Saving…</p>}
        </div>
      )}
    </div>
  );
}

function FieldStack({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}

// ─── Persistent add-set form (one per box) ──────────────────────────────────────

export function AddSetForm({
  draft,
  labelRef,
  isAdding,
  onChange,
  onAdd,
  onClear,
}: {
  draft: SetDraft;
  labelRef: React.RefObject<HTMLInputElement | null>;
  isAdding: boolean;
  onChange: (d: SetDraft) => void;
  onAdd: () => void;
  onClear: () => void;
}) {
  const set = (patch: Partial<SetDraft>) => onChange({ ...draft, ...patch });
  const empty = !draft.label && !draft.startTime && draft.duration === emptySetDraft.duration;
  return (
    <div className="mt-2 rounded-md border border-dashed border-border bg-background p-2.5">
      <p className="mb-2 text-xs font-medium text-muted">Add a set</p>
      <div className="space-y-2">
        <FieldStack label="Label">
          <Input
            ref={labelRef as React.RefObject<HTMLInputElement>}
            value={draft.label}
            onChange={(e) => set({ label: e.target.value })}
            placeholder="e.g. Ceremony"
            aria-label="New set label"
          />
        </FieldStack>
        <div className="grid grid-cols-2 gap-2">
          <FieldStack label="Minutes">
            <Input type="number" min={1} value={draft.duration} onChange={(e) => set({ duration: e.target.value })} aria-label="New set duration" />
          </FieldStack>
          <FieldStack label="Start">
            <Input type="time" value={draft.startTime} onChange={(e) => set({ startTime: e.target.value })} aria-label="New set start time" />
          </FieldStack>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Button size="sm" onClick={onAdd} disabled={isAdding || empty}>{isAdding ? 'Adding…' : 'Add set'}</Button>
        <button
          type="button"
          onClick={onClear}
          disabled={empty}
          className="text-sm text-muted transition-colors hover:text-foreground disabled:opacity-40"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

// ─── Package box header: editable name + icon + remove ──────────────────────────

export function PackageBoxHeader({
  pkg,
  setCount,
  isRemoving,
  onUpdate,
  onRemove,
}: {
  pkg: BookingPackageSummary;
  setCount: number;
  isRemoving: boolean;
  onUpdate: (dto: { label?: string; icon?: string }) => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(pkg.label);
  const [iconOpen, setIconOpen] = useState(false);
  useEffect(() => setName(pkg.label), [pkg.label]);

  function commit() {
    const next = name.trim();
    if (!next || next === pkg.label) { setName(pkg.label); return; }
    onUpdate({ label: next });
  }

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        {/* Bordered tile → persistent "tap to change icon" affordance (no hover reliance). */}
        <button
          type="button"
          onClick={() => setIconOpen((o) => !o)}
          aria-label={`Change ${pkg.label} icon`}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <PackageIcon icon={pkg.icon} />
        </button>
        {/* Visibly bordered input → reads as an editable field, not a heading. */}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          aria-label="Package name"
          placeholder="Package name"
          className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 text-sm font-medium text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="button"
          onClick={onRemove}
          disabled={isRemoving}
          aria-label={`Remove ${pkg.label}`}
          className="flex-shrink-0 p-1 text-muted transition-colors hover:text-status-cancelled disabled:opacity-50"
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>
      <p className="mt-1 px-0.5 text-xs text-muted">{setCount} {setCount === 1 ? 'set' : 'sets'}</p>
      {iconOpen && (
        <div className="mt-2">
          <IconPicker value={pkg.icon} onChange={(icon) => { onUpdate({ icon }); setIconOpen(false); }} label={null} />
        </div>
      )}
    </div>
  );
}

// ─── Apply-template picker ──────────────────────────────────────────────────────

export function TemplatePicker({
  templates,
  templatesLoading,
  eventType,
  isApplying,
  onApply,
  onCancel,
}: {
  templates: PackageTemplate[];
  templatesLoading: boolean;
  eventType: string;
  isApplying: boolean;
  onApply: (templateId: string) => void;
  onCancel: () => void;
}) {
  const [otherOpen, setOtherOpen] = useState(false);

  // Provenance is severed (ADR-0046): booking-owned Packages carry no FK back to the template,
  // so all enabled templates are offered — those matching the event type lead.
  const enabled = templates.filter((t) => t.enabled);
  const matching = enabled.filter((t) => t.category === eventType);
  const other = enabled.filter((t) => t.category !== eventType);

  function chip(tmpl: PackageTemplate) {
    return (
      <button
        key={tmpl.id}
        type="button"
        disabled={isApplying}
        onClick={() => onApply(tmpl.id)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm transition-colors hover:border-primary disabled:opacity-50"
      >
        <PackageIcon icon={tmpl.icon} />
        {tmpl.label}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <SubLabel>Select a package</SubLabel>
      {templatesLoading && <p className="text-sm text-muted">Loading…</p>}
      {!templatesLoading && enabled.length === 0 && (
        <p className="text-sm text-muted">No package templates available.</p>
      )}
      {!templatesLoading && enabled.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(matching.length > 0 ? matching : other).map(chip)}
          </div>
          {matching.length > 0 && other.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setOtherOpen((o) => !o)}
                className="text-sm text-muted transition-colors hover:text-foreground"
              >
                {otherOpen ? '▾' : '▸'} Other packages ({other.length})
              </button>
              {otherOpen && <div className="mt-2 flex flex-wrap gap-2">{other.map(chip)}</div>}
            </div>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={onCancel}
        className={cn('text-sm text-muted transition-colors hover:text-foreground')}
      >
        Cancel
      </button>
    </div>
  );
}

// ─── Set timeline ordering (reused from the read-view card) ─────────────────────

export { orderTimelineSets } from './ItineraryCard';
