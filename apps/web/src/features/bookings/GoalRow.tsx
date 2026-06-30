import { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  SkipForward,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { RowActions, type RowAction } from '@/components/common/RowActions';
import type { ChecklistItem, ChecklistItemState, ChecklistStep } from '@/types/api';
import { resolveChecklistShortcut, type ChecklistShortcutHandlers } from './checklistShortcuts';

// GoalRow renders one checklist goal (ADR-0057) to the #604-locked "action-led row" design —
// atomic and multi-step alike, unified (#610).
//   • Tier 1 — goal line: a status glyph (a milestone progress ring while a multi-step goal is in
//     flight) + the label + a ⋯ menu. The glyph is informational, never tappable: a goal completes
//     by roll-up or via the menu, not by ticking a glyph.
//   • Tier 2 — the one interactive line: a multi-step goal shows its active step (a wand-led CTA for
//     an ACTION step, a muted wait for an AWAITED step); an atomic goal shows its own action (a wand
//     CTA when the app can help, or a plain "Mark complete"). Steps fold and reveal on disclosure.

// The states the musician can set on a goal via the menu / atomic action. The glyph reads the full
// ChecklistItemState (incl. FAILED, which the system sets) but FAILED is never user-settable here.
type SettableGoalState = 'COMPLETE' | 'PENDING' | 'SKIPPED';

// The active step is the first non-terminal step by order (ADR-0057: derived, never stored).
export function activeStep(item: ChecklistItem): ChecklistStep | null {
  const steps = item.steps ?? [];
  return steps.find((s) => s.state === 'PENDING' || s.state === 'FAILED') ?? null;
}

function isMultiStep(item: ChecklistItem): boolean {
  return (item.steps?.length ?? 0) > 0;
}

// Milestone progress: completed milestone steps over total. Ring = what's done; the x/y count =
// where you are — they deliberately differ (e.g. a ⅓-filled ring next to "2/3").
function milestoneProgress(item: ChecklistItem): { done: number; total: number } {
  const spine = (item.steps ?? []).filter((s) => s.kind === 'MILESTONE');
  return { done: spine.filter((s) => s.state === 'COMPLETE').length, total: spine.length };
}

// Personalised waiting text by who the step awaits. Naming the specific person (#604 open
// question) is deferred — a generic party keeps the row free of booking-context plumbing.
function awaitingParty(step: ChecklistStep): string | null {
  if (step.completedBy === 'CUSTOMER') return 'the client';
  if (step.completedBy === 'BAND_MEMBER') return 'the band';
  return null;
}

function dueDateDisplay(dueDate: string | null | undefined): { text: string; className: string } | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - now.getTime()) / 86400000);
  if (diffDays < 0) {
    const n = Math.abs(diffDays);
    return { text: n === 1 ? '1 day overdue' : `${n} days overdue`, className: 'text-status-cancelled' };
  }
  if (diffDays === 0) return { text: 'Due today', className: 'text-amber-600' };
  if (diffDays === 1) return { text: 'Due tomorrow', className: 'text-amber-600' };
  if (diffDays <= 7) return { text: `Due in ${diffDays} days`, className: 'text-amber-600' };
  return {
    text: `Due ${due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
    className: 'text-muted',
  };
}

// Status glyph — informational only, never tappable. Consistent meaning for goals and steps:
// pending = circle, done = check, awaited = clock, failed = alert.
function StepGlyph({ step, size = 13 }: { step: ChecklistStep; size?: number }) {
  if (step.state === 'COMPLETE') return <CheckCircle2 size={size} className="flex-shrink-0 text-muted" />;
  if (step.state === 'FAILED') return <AlertTriangle size={size} className="flex-shrink-0 text-status-cancelled" />;
  if (step.completeMode === 'AWAITED') return <Clock size={size} className="flex-shrink-0 text-muted" />;
  return <Circle size={size} className="flex-shrink-0 text-border" />;
}

// Progress ring — leading goal glyph, fills clockwise by milestone completeness (Things-style),
// in status-confirmed green (a sanctioned palette exception, #604), resolving into the done check.
function ProgressRing({ done, total, size = 17 }: { done: number; total: number; size?: number }) {
  const stroke = 2;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const frac = total ? done / total : 0;
  const mid = size / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="flex-shrink-0 -rotate-90"
      aria-hidden="true"
    >
      <circle cx={mid} cy={mid} r={r} fill="none" strokeWidth={stroke} stroke="currentColor" className="text-border" />
      <circle
        cx={mid}
        cy={mid}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        stroke="currentColor"
        className="text-status-confirmed"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - frac)}
      />
    </svg>
  );
}

function GoalGlyph({ item }: { item: ChecklistItem }) {
  const isPlay = item.key === 'play_the_gig';
  if (item.state === 'COMPLETE') {
    return isPlay ? (
      <Sparkles size={17} className="flex-shrink-0 text-status-ready" />
    ) : (
      <CheckCircle2 size={17} className="flex-shrink-0 text-status-confirmed" />
    );
  }
  if (item.state === 'SKIPPED') {
    return (
      <span className="flex h-[17px] w-[17px] flex-shrink-0 items-center justify-center rounded-full border border-muted text-muted">
        <SkipForward size={9} />
      </span>
    );
  }
  if (item.state === 'FAILED') return <AlertTriangle size={17} className="flex-shrink-0 text-status-cancelled" />;
  const { done, total } = milestoneProgress(item);
  if (total > 0) return <ProgressRing done={done} total={total} />;
  return isPlay ? (
    <Sparkles size={17} className="flex-shrink-0 text-muted" />
  ) : (
    <Circle size={17} className="flex-shrink-0 text-muted" />
  );
}

// The goal's overflow actions — the opt-out levers (ADR-0057). Completion + Skip live here so the
// glyph stays informational. Rendered via RowActions: a bottom Sheet on mobile, a popover on
// desktop. (Delete of a custom goal is deferred — no API endpoint yet; custom goals opt out via
// Skip like any other.)
// No icons on the actions: RowActions promotes the first action's icon to a standalone desktop
// quick-shortcut, which would duplicate the inline action (an atomic goal's inline CTA is already
// "Mark complete"). Text-only items keep the overflow menu a deliberate, single affordance.
function goalMenuActions(state: ChecklistItemState, onSetState: (s: SettableGoalState) => void): RowAction[] {
  if (state === 'SKIPPED') return [{ label: 'Restore', onClick: () => onSetState('PENDING') }];
  if (state === 'COMPLETE') return [{ label: 'Mark as not done', onClick: () => onSetState('PENDING') }];
  return [
    { label: 'Mark complete', onClick: () => onSetState('COMPLETE') },
    { label: 'Skip', onClick: () => onSetState('SKIPPED') },
  ];
}

// The active-step line of a multi-step goal: a wand-led CTA (label IS the action) for an ACTION
// step, or a muted, non-actionable waiting line for an AWAITED step. Ends with the step position.
function ActiveStepLine({
  step,
  position,
  total,
  handlers,
}: {
  step: ChecklistStep;
  position: number;
  total: number;
  handlers: ChecklistShortcutHandlers;
}) {
  const resolved =
    step.completeMode === 'ACTION'
      ? resolveChecklistShortcut(
          { shortcutType: step.shortcutType, shortcutTemplateType: step.shortcutTemplateType, isFailed: step.state === 'FAILED' },
          handlers,
        )
      : null;
  const party = awaitingParty(step);

  return (
    <div className="mt-1 flex items-center gap-2">
      {resolved ? (
        <button
          onClick={resolved.onClick}
          disabled={resolved.pending}
          className="flex min-w-0 items-center gap-1.5 text-left text-sm text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          <WandSparkles size={14} className="flex-shrink-0" />
          <span className="truncate">{resolved.pending ? (resolved.pendingLabel ?? step.label) : step.label}</span>
        </button>
      ) : (
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
          <Clock size={13} className="flex-shrink-0" />
          <span className="truncate">{party ? `${step.label} · Waiting on ${party}` : step.label}</span>
        </div>
      )}
      {total > 0 && position > 0 && (
        <span className="ml-auto flex-shrink-0 text-xs tabular-nums text-muted">
          {position}/{total}
        </span>
      )}
    </div>
  );
}

// The action line of an atomic goal: a wand CTA when the app can help do it (Set up / Send / Create
// / Mark as played), or a plain "Mark complete" for a goal with no shortcut (custom/inert).
function AtomicActionLine({
  item,
  handlers,
  onSetState,
}: {
  item: ChecklistItem;
  handlers: ChecklistShortcutHandlers;
  onSetState: (s: SettableGoalState) => void;
}) {
  const isFailed = item.state === 'FAILED';

  if (item.key === 'play_the_gig') {
    return (
      <button
        onClick={() => {
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
          onSetState('COMPLETE');
        }}
        className="mt-1 flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        <WandSparkles size={14} className="flex-shrink-0" /> Mark as played
      </button>
    );
  }

  const resolved = resolveChecklistShortcut(
    { shortcutType: item.shortcutType, shortcutTemplateType: item.shortcutType ? item.shortcutTemplateType : undefined, itemKey: item.key, isFailed },
    handlers,
  );
  if (resolved) {
    return (
      <button
        onClick={resolved.onClick}
        disabled={resolved.pending}
        className="mt-1 flex items-center gap-1.5 text-sm text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
      >
        <WandSparkles size={14} className="flex-shrink-0" />
        {resolved.pending ? (resolved.pendingLabel ?? resolved.label) : resolved.label}
      </button>
    );
  }

  // No shortcut — a manual tick (custom/inert goal). A check icon signals "you do this one".
  return (
    <button onClick={() => onSetState('COMPLETE')} className="mt-1 flex items-center gap-1.5 text-sm text-primary hover:underline">
      <CheckCircle2 size={14} className="flex-shrink-0" /> Mark complete
    </button>
  );
}

// The remaining steps revealed on disclosure (the active one is the CTA above). Completed steps
// fold here with a struck label; upcoming steps are muted.
function StepsList({ item, activeId }: { item: ChecklistItem; activeId?: string }) {
  const others = (item.steps ?? []).filter((s) => s.id !== activeId);
  if (others.length === 0) return null;
  return (
    <ul className="mt-2 space-y-2 border-t border-border pt-2">
      {others.map((step) => (
        <li key={step.id} className="flex items-center gap-2">
          <StepGlyph step={step} />
          <span className={cn('text-xs text-muted', step.state === 'COMPLETE' && 'line-through')}>{step.label}</span>
        </li>
      ))}
    </ul>
  );
}

export interface GoalRowProps {
  item: ChecklistItem;
  handlers: ChecklistShortcutHandlers;
  onSetState: (itemId: string, state: SettableGoalState) => void;
}

export function GoalRow({ item, handlers, onSetState }: Readonly<GoalRowProps>) {
  const [expanded, setExpanded] = useState(false);
  const multi = isMultiStep(item);
  const active = activeStep(item);
  const isDone = item.state === 'COMPLETE';
  const isSkipped = item.state === 'SKIPPED';
  const isResolved = isDone || isSkipped;
  const due = dueDateDisplay(item.dueDate);

  // x/y = which milestone step you're ON (1-based position) over the total.
  const milestones = (item.steps ?? []).filter((s) => s.kind === 'MILESTONE');
  const position = active ? milestones.findIndex((s) => s.id === active.id) + 1 : 0;

  const setState = (s: SettableGoalState) => onSetState(item.id, s);

  return (
    <div className={cn('py-1.5', isResolved && 'opacity-60')}>
      {/* Goal line — glyph centred with the label + the ⋯ menu. The active step / atomic action
          and disclosure sit indented beneath the label, so the glyph reads as the goal's status. */}
      <div className="flex items-center gap-3">
        <GoalGlyph item={item} />
        <span className={cn('min-w-0 flex-1 truncate text-sm font-medium', isResolved ? 'text-muted' : 'text-foreground')}>
          {item.label}
        </span>
        {due && !isResolved && <span className={cn('flex-shrink-0 text-xs', due.className)}>{due.text}</span>}
        <RowActions actions={goalMenuActions(item.state, setState)} label={item.label} />
      </div>

      <div className="ml-[1.8rem]">
        {multi && active && <ActiveStepLine step={active} position={position} total={milestones.length} handlers={handlers} />}

        {!multi && !isResolved && <AtomicActionLine item={item} handlers={handlers} onSetState={setState} />}

        {multi && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-1.5 flex items-center gap-1 text-xs text-muted hover:text-foreground"
            aria-expanded={expanded}
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {expanded ? 'Hide steps' : 'See all steps'}
          </button>
        )}

        {multi && expanded && <StepsList item={item} activeId={active?.id} />}
      </div>
    </div>
  );
}
