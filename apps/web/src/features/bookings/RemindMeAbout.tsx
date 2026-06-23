import { BOOKING_STATUS_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { ApplicableReminder } from '@/types/api';

// The reusable "Remind me about" control (Smart Reminders, ADR-0052 / #556). Presentational
// only: it renders the engine selector's output for one concern as a quiet on/off list and
// emits the user's toggle intent via `onToggle`. It owns no fetch and no mutation — the
// container decides enable-vs-skip from the row's source/state and injects per-row busy state.
//
// Design (prototype verdict, #556): a "Remind me to" list. Each row names the booking status
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

/** A reminder row plus presentational extras the raw selector output doesn't carry. */
export interface ReminderRow extends ApplicableReminder {
  /**
   * The dependency action phrase, rendered as "…, after you <after>" (e.g. "send the contract").
   * Deferred wiring (#557/#558): the #555 selector DTO carries no dependency field yet, so this is
   * undefined for the Venue tracer. The container will only set it when the dependency is a *live
   * gate* — still pending, tracked, and not globally disabled — matching the blocking predicate.
   */
  after?: string;
}

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
function AfterClause({ after }: { after?: string }) {
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

export function RemindMeAbout({ reminders, onToggle, busyKeys }: RemindMeAboutProps) {
  if (reminders.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted">Remind me to</p>
      <ul className="space-y-2">
        {reminders.map((reminder) => {
          const id = reminderRowId(reminder);
          const busy = busyKeys?.has(id) ?? false;
          return (
            <li
              key={id}
              className={cn(
                'flex items-center gap-3 rounded-lg border border-border px-4 py-3',
                !reminder.on && 'bg-secondary/40',
              )}
            >
              <div className="min-w-0 flex-1">
                <span className={cn('block truncate text-base', !reminder.on && 'text-muted')}>
                  {reminder.label}
                </span>
                <span className="text-sm text-muted">
                  <Subline reminder={reminder} />
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
        })}
      </ul>
    </div>
  );
}
