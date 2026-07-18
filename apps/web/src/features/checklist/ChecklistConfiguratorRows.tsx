import { useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { REMINDER_CONCERN_LABELS, REMINDER_CONCERN_ORDER } from '@/lib/constants';
import { DueDateEditor, formatDueDateRule } from './DueDateEditor';
import type { ChecklistDefaultStep, DueDateRule, ReminderConcern } from '@/types/api';

// ── Read-only steps preview ────────────────────────────────────────────────────────────────────
// Collapsed by default. A static overview of everything a multi-step goal does — its precondition and
// milestone steps in catalogue order — distinct from the live booking GoalRow (which shows the single
// active step). Read-only: the system owns step sequencing (ADR-0057), shown here for understanding.
// A short kind tag for a step: preconditions are prerequisites, awaited milestones wait on an external
// event (a payment, a signature), the rest are musician actions in sequence.
function stepTag(step: ChecklistDefaultStep): string {
  if (step.kind === 'PRECONDITION') return 'Needs';
  if (step.completeMode === 'AWAITED') return 'Awaits';
  return 'Step';
}

export function StepsDisclosure({ steps, goalLabel }: { steps: ChecklistDefaultStep[]; goalLabel: string }) {
  const [open, setOpen] = useState(false);
  if (steps.length === 0) return null;
  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1 text-xs text-muted hover:text-foreground"
      >
        {open ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}
        {open ? 'Hide steps' : `Steps (${steps.length})`}
      </button>
      {open && (
        <ol className="mt-1.5 space-y-1 border-l border-border pl-3">
          {steps.map((step) => (
            <li key={step.key} className="flex items-center gap-2 text-xs">
              <span
                className={cn(
                  'rounded px-1 py-0.5 leading-none border',
                  step.kind === 'PRECONDITION'
                    ? 'text-muted border-border'
                    : 'text-primary/70 border-primary/30',
                )}
              >
                {stepTag(step)}
              </span>
              <span className="text-foreground">{step.label}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="sr-only">Read-only steps for {goalLabel}. GigLoop sequences these for you.</p>
    </div>
  );
}

// ── System goal row ────────────────────────────────────────────────────────────────────────────
// Label + plain-English summary + enable/disable Switch + goal-level due-date editor. No completedBy
// pill (#718): every default goal is the user's. A multi-step goal reveals its read-only steps below.
export function SystemGoalRow({
  label,
  summary,
  enabled,
  gated,
  dueDateRule,
  steps,
  onToggle,
  onDueDateChange,
}: {
  label: string;
  summary?: string;
  enabled: boolean;
  gated: boolean;
  dueDateRule: DueDateRule | null;
  steps: ChecklistDefaultStep[];
  onToggle: (value: boolean) => void;
  onDueDateChange: (rule: DueDateRule | null) => void;
}) {
  const effective = gated ? false : enabled;
  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn('text-base', effective ? 'text-foreground' : 'text-muted')}>{label}</p>
          {summary && <p className="text-sm text-muted mt-0.5">{summary}</p>}
        </div>
        <Switch
          checked={effective}
          disabled={gated}
          onCheckedChange={(v) => !gated && onToggle(v)}
          aria-label={`${label}: ${effective ? 'enabled' : 'disabled'}`}
        />
      </div>
      {gated ? (
        <p className="text-xs text-muted mt-1">Enable the song request form to include this reminder.</p>
      ) : (
        <div className="mt-1.5">
          <DueDateEditor value={dueDateRule} onChange={onDueDateChange} ariaLabel={label} />
        </div>
      )}
      <StepsDisclosure steps={steps} goalLabel={label} />
    </div>
  );
}

// ── Concern (section) picker, shared by the custom add/edit form ─────────────────────────────────
function ConcernSelect({
  value,
  onChange,
}: {
  value: ReminderConcern | 'NONE';
  onChange: (v: ReminderConcern | 'NONE') => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ReminderConcern | 'NONE')}>
      <SelectTrigger className="w-40 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="NONE">No section</SelectItem>
        {REMINDER_CONCERN_ORDER.map((c) => (
          <SelectItem key={c} value={c}>
            {REMINDER_CONCERN_LABELS[c]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export interface CustomFormData {
  label: string;
  concern: ReminderConcern | null;
  dueDateRule: DueDateRule | null;
}

// ── Custom item add/edit form ────────────────────────────────────────────────────────────────────
// The stage a custom belongs to is the card it is added under, so there is no stage picker here.
// completedBy is removed from the UI (#718) — the container always saves USER. The delete affordance
// is present only when editing an existing item.
export function CustomItemForm({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: CustomFormData;
  onSave: (data: CustomFormData) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [concern, setConcern] = useState<ReminderConcern | 'NONE'>(initial?.concern ?? 'NONE');
  const [dueDateRule, setDueDateRule] = useState<DueDateRule | null>(initial?.dueDateRule ?? null);

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Reminder label"
          className="text-sm flex-1"
          autoFocus
        />
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="text-muted hover:text-status-cancelled transition-colors flex-shrink-0"
            aria-label={`Delete ${label || 'reminder'}`}
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <ConcernSelect value={concern} onChange={setConcern} />
        <DueDateEditor value={dueDateRule} onChange={setDueDateRule} ariaLabel={label || 'reminder'} />
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="text-xs h-7"
          disabled={!label.trim()}
          onClick={() => onSave({ label: label.trim(), concern: concern === 'NONE' ? null : concern, dueDateRule })}
        >
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" className="text-xs h-7" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ── Custom item row (collapsed) ──────────────────────────────────────────────────────────────────
// A plain todo: label + "Custom" tag + optional section tag + due-date summary + edit/delete. No step
// machinery — a lightweight reminder stays lightweight.
export function CustomRow({
  label,
  concern,
  dueDateRule,
  onEdit,
  onDelete,
}: {
  label: string;
  concern: string | null;
  dueDateRule: DueDateRule | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
        <span className="text-base text-foreground">{label}</span>
        <span className="text-xs text-primary/60 border border-primary/30 rounded px-1 py-0.5 leading-none">Custom</span>
        {concern && (
          <span className="text-xs text-muted border border-border rounded px-1 py-0.5 leading-none">
            {REMINDER_CONCERN_LABELS[concern as ReminderConcern] ?? concern}
          </span>
        )}
        <span className="text-xs text-muted">{formatDueDateRule(dueDateRule)}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
          aria-label={`Edit ${label}`}
        >
          Edit <Pencil size={11} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="text-muted hover:text-status-cancelled transition-colors"
          aria-label={`Delete ${label}`}
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
