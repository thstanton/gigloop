import { useState } from 'react';
import { CheckCircle2, ChevronDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GhostButton } from '@/components/common/GhostButton';
import { BOOKING_STATUS_LABELS, statusGte } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { ApplicableReminder, BookingStatus } from '@/types/api';

// The reusable "Remind me about" control (Smart Reminders, ADR-0052 / #556). Presentational
// only: it renders the engine selector's output for one concern as a quiet on/off list and
// emits the user's toggle intent via `onToggle`. It owns no fetch and no mutation — the
// container decides enable-vs-skip from the row's source/state and injects per-row busy state.
//
// Design (prototype verdict, #556): a "Remind me about" list. Each row names the booking status
// the work is done *during* — coaching the lifecycle vocabulary — in that status's colour while
// on, dimmed while off. Lifecycle state (COMPLETE/BLOCKED/FAILED) is deliberately NOT shown:
// that is the checklist's job; this control is on/off only.

type RequiredStatus = ApplicableReminder['requiredForStatus'];

// `requiredForStatus` is the status a reminder is a prerequisite *for*, so the work happens
// during the preceding stage (send the contract — prereq for Confirmed — while still Provisional).
const PRECEDING: Record<NonNullable<RequiredStatus>, 'ENQUIRY' | 'PROVISIONAL' | 'CONFIRMED' | 'READY'> = {
  PROVISIONAL: 'ENQUIRY',
  CONFIRMED: 'PROVISIONAL',
  READY: 'CONFIRMED',
  COMPLETE: 'READY',
};

const STATUS_TONE: Record<'ENQUIRY' | 'PROVISIONAL' | 'CONFIRMED' | 'READY', string> = {
  ENQUIRY: 'text-status-enquiry',
  PROVISIONAL: 'text-status-provisional',
  CONFIRMED: 'text-status-confirmed',
  READY: 'text-status-ready',
};

/**
 * A reminder row. The selector output carries everything the control renders, including the
 * dependency `after` clause (#557/#558) and the auto-complete `autoCompleteHint` (#567); this alias
 * exists so the presentational layer has a name distinct from the DTO type.
 */
export type ReminderRow = ApplicableReminder;

/**
 * Stable per-row identity. The system `key` is preferred because it is stable across an
 * on-demand seed (a discoverable reminder's `itemId` goes from null → uuid when seeded, but its
 * key never changes) — so busy-tracking and React keys survive the seed. Custom items have no
 * key and fall back to their `itemId`.
 */
export function reminderRowId(r: ApplicableReminder): string {
  return r.key ?? r.itemId ?? '';
}

export interface RemindMeAboutProps {
  /** The concern's reminders, in render order (engine selector output). */
  reminders: ReminderRow[];
  /** The user toggled a row. The container maps this to enable (on-demand seed/un-skip) or skip. */
  onToggle: (reminder: ApplicableReminder) => void;
  /** Rows with an in-flight toggle — their action is disabled to prevent a double-fire. */
  busyKeys?: ReadonlySet<string>;
  /**
   * The "add your own" path (#559): create a personal reminder tagged to this concern. When
   * provided, the control offers an add affordance collecting a label and a stage (#568) — the
   * stage (`requiredForStatus`) lets the custom join the stage filter / passed-stage collapse like
   * a system reminder. Returns the create promise so the form can clear + close on success and
   * keep the draft on failure (the container surfaces the error).
   */
  onAdd?: (label: string, requiredForStatus: RequiredStatus) => Promise<unknown>;
  /**
   * The booking's current status. When provided, reminders whose work window has already passed
   * (the work happens during the stage *preceding* `requiredForStatus`, so it has passed once the
   * booking reaches `requiredForStatus` — i.e. `requiredForStatus <= currentStatus`) are collapsed
   * behind a "show passed" disclosure instead of listed. Omit to list every reminder.
   */
  currentStatus?: BookingStatus;
}

// The status the work is done during — bold, and in its status colour unless the reminder is off.
function StatusName({ status, dimmed }: { status: NonNullable<RequiredStatus>; dimmed?: boolean }) {
  const display = PRECEDING[status];
  return (
    <span className={cn('font-semibold', !dimmed && STATUS_TONE[display])}>
      {BOOKING_STATUS_LABELS[display]}
    </span>
  );
}

// The dependency chain, e.g. ", after you send the contract". Only present once the dependency
// is a live gate (set by the container; see ReminderRow.after).
function AfterClause({ after }: { after: string | null }) {
  if (!after) return null;
  return <>, after you {after}</>;
}

function Subline({ reminder }: { reminder: ReminderRow }) {
  if (reminder.on) {
    return reminder.requiredForStatus ? (
      <>Reminding you when the booking is <StatusName status={reminder.requiredForStatus} /><AfterClause after={reminder.after} /></>
    ) : (
      <>Reminding you<AfterClause after={reminder.after} /></>
    );
  }
  // Off reads the same whether skipped or never-seeded — the on-demand-seed vs un-skip
  // distinction is the container's concern, not the user's (unified wording, #556).
  return reminder.requiredForStatus ? (
    <>Could remind you when the booking is <StatusName status={reminder.requiredForStatus} dimmed /><AfterClause after={reminder.after} /></>
  ) : (
    <>Could remind you<AfterClause after={reminder.after} /></>
  );
}

function actionLabel(reminder: ApplicableReminder): string {
  return reminder.on ? 'Turn off' : 'Remind me';
}

// The "add your own" affordance (#559): a quiet "+ Add your own" trigger that reveals a label input
// plus a stage picker (#568). Mirrors the Checklist card's add-item idiom (label, then a "Required
// for …" stage Select). Tagging to the concern is the container's job — this collects the label and
// the chosen stage. Awaits onAdd so it clears + closes on success and keeps the draft on failure
// (the container toasts). Stacks vertically so it fits at 375px.
//
// `NO_STAGE` is the Select sentinel for "no stage requirement"; it maps to a null requiredForStatus
// (the row never enters the stage filter / passed collapse). The other options mirror the lifecycle
// statuses a checklist item can gate — ENQUIRY is excluded because it is the first stage, so nothing
// can be required *for* it (matching the Checklist card and the PRECEDING coaching map above).
const NO_STAGE = 'NONE';
const STAGE_OPTIONS: { value: NonNullable<RequiredStatus>; label: string }[] = [
  { value: 'PROVISIONAL', label: 'Required for Provisional' },
  { value: 'CONFIRMED', label: 'Required for Confirmed' },
  { value: 'READY', label: 'Required for Ready' },
  { value: 'COMPLETE', label: 'Required for Complete' },
];

function AddYourOwn({ onAdd }: { onAdd: (label: string, requiredForStatus: RequiredStatus) => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [stage, setStage] = useState<string>(NO_STAGE);
  const [submitting, setSubmitting] = useState(false);
  const label = draft.trim();

  if (!open) {
    return (
      <GhostButton variant="primary" size="xs" icon={<Plus size={12} />} onClick={() => setOpen(true)}>
        Add your own
      </GhostButton>
    );
  }

  const reset = () => { setDraft(''); setStage(NO_STAGE); setOpen(false); };

  const submit = async () => {
    if (!label || submitting) return;
    setSubmitting(true);
    try {
      await onAdd(label, stage === NO_STAGE ? null : (stage as NonNullable<RequiredStatus>));
      reset();
    } catch {
      // The container surfaces the failure via toast; keep the form open with the draft intact.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Item label"
        className="text-sm"
      />
      <Select value={stage} onValueChange={setStage}>
        <SelectTrigger className="h-8 w-full text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_STAGE}>No stage requirement</SelectItem>
          {STAGE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!label || submitting}>
          {submitting ? 'Adding…' : 'Add'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={reset}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function RemindMeAbout({ reminders, onToggle, busyKeys, currentStatus, onAdd }: RemindMeAboutProps) {
  const [showPassed, setShowPassed] = useState(false);
  // Render the control when there's anything to show — reminders, or just the add-your-own entry
  // point on an otherwise-empty concern.
  if (reminders.length === 0 && !onAdd) return null;

  // A reminder's work happens during the stage preceding `requiredForStatus`, so that window has
  // passed once the booking reaches `requiredForStatus`. Stage-less customs never count as passed.
  const isPassed = (r: ReminderRow) =>
    currentStatus != null &&
    r.requiredForStatus != null &&
    statusGte(currentStatus, r.requiredForStatus);
  let active = reminders.filter((r) => !isPassed(r));
  let passed = reminders.filter(isPassed);

  // Always lead with at least one reminder. When every reminder has passed (e.g. a single-reminder
  // concern past its stage, or a fully-played booking), promote the most recent — last in workflow
  // order, i.e. closest to now — so the section never collapses to a bare disclosure.
  if (active.length === 0 && passed.length > 0) {
    active = [passed[passed.length - 1]];
    passed = passed.slice(0, -1);
  }

  const renderRow = (reminder: ReminderRow) => {
    const id = reminderRowId(reminder);
    const busy = busyKeys?.has(id) ?? false;
    return (
      <li
        key={id}
        className={cn(
          'flex items-center gap-3 rounded-lg border border-border px-4 py-1.5',
          !reminder.on && 'bg-secondary/40',
        )}
      >
        <div className="min-w-0 flex-1">
          <span className={cn('block truncate text-base', !reminder.on && 'text-muted')}>
            {reminder.label}
          </span>
          <span className="block text-sm text-muted">
            <Subline reminder={reminder} />
            {/* Auto-complete condition (#567): the "when …" tail, led by a muted circled tick so it
                reads "✓ when the client signs in the portal". Muted (not success-green) keeps it on
                the right side of ADR-0052's no-lifecycle-state line — it explains how the reminder
                resolves, without implying it's already done. */}
            {reminder.autoCompleteHint && (
              <span className="text-muted/80">
                {' · '}
                <CheckCircle2 className="inline h-3.5 w-3.5 align-text-bottom" aria-hidden />{' '}
                {reminder.autoCompleteHint}
              </span>
            )}
          </span>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => onToggle(reminder)}
          className={cn(
            'shrink-0 text-sm font-medium disabled:opacity-50',
            reminder.on ? 'text-muted hover:text-foreground' : 'text-primary',
          )}
        >
          {actionLabel(reminder)}
        </button>
      </li>
    );
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted">Remind me about</p>
      {/* `active` holds ≥1 reminder whenever any exist (the min-1 promotion above); it is only empty
          on a concern with no reminders at all, where just the add-your-own entry point shows. */}
      {active.length > 0 && <ul className="space-y-2">{active.map(renderRow)}</ul>}
      {passed.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowPassed((v) => !v)}
            className="flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground"
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform', !showPassed && '-rotate-90')} />
            {showPassed ? 'Hide' : 'Show'} {passed.length} passed reminder{passed.length === 1 ? '' : 's'}
          </button>
          {showPassed && <ul className="space-y-2">{passed.map(renderRow)}</ul>}
        </div>
      )}
      {onAdd && <AddYourOwn onAdd={onAdd} />}
    </div>
  );
}
