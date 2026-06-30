import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  WandSparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChecklistItem, ChecklistStep } from '@/types/api';
import { resolveChecklistShortcut, type ChecklistShortcutHandlers } from './checklistShortcuts';

// GoalRow renders a multi-step goal (ADR-0057) to the #604-locked "action-led row" design.
//   • Tier 1 — goal line: a status glyph (a milestone progress ring while in flight) + the label.
//     Never tappable for completion — a multi-step goal completes by roll-up, not a tick.
//   • Tier 2 — active-step line: the single interactive element. An ACTION step is a wand-led CTA
//     whose label IS the action; an AWAITED step is a muted, non-actionable waiting line.
//   • The `x/y` count is the *position* of the current step (not the completed count); steps fold
//     away and reveal on a "See all steps" disclosure.
// The kebab menu (Mark complete / Skip / Delete) and unifying atomic rows into this look are #610.

// The active step is the first non-terminal step by order (ADR-0057: derived, never stored).
export function activeStep(item: ChecklistItem): ChecklistStep | null {
  const steps = item.steps ?? [];
  return steps.find((s) => s.state === 'PENDING' || s.state === 'FAILED') ?? null;
}

// Milestone progress: completed milestone steps over total. Ring = what's done; the x/y count =
// where you are — they deliberately differ (e.g. a ⅓-filled ring next to "2/3").
function milestoneProgress(item: ChecklistItem): { done: number; total: number } {
  const spine = (item.steps ?? []).filter((s) => s.kind === 'MILESTONE');
  return { done: spine.filter((s) => s.state === 'COMPLETE').length, total: spine.length };
}

// Personalised waiting text by who the step awaits. Naming the specific person (#604 open
// question) is deferred — a generic party keeps #611 free of booking-context plumbing.
function awaitingParty(step: ChecklistStep): string | null {
  if (step.completedBy === 'CUSTOMER') return 'the client';
  if (step.completedBy === 'BAND_MEMBER') return 'the band';
  return null;
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
  if (item.state === 'COMPLETE') return <CheckCircle2 size={17} className="flex-shrink-0 text-status-confirmed" />;
  if (item.state === 'FAILED') return <AlertTriangle size={17} className="flex-shrink-0 text-status-cancelled" />;
  const { done, total } = milestoneProgress(item);
  if (total > 0) return <ProgressRing done={done} total={total} />;
  return <Circle size={17} className="flex-shrink-0 text-muted" />;
}

// The active-step line: a wand-led CTA (label IS the action) for an ACTION step, or a muted,
// non-actionable waiting line for an AWAITED step. Ends with the "step x of y" position count.
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
          <span
            className={cn(
              'text-xs',
              step.state === 'COMPLETE' && 'text-muted line-through',
              step.state !== 'COMPLETE' && 'text-muted',
            )}
          >
            {step.label}
          </span>
        </li>
      ))}
    </ul>
  );
}

export interface GoalRowProps {
  item: ChecklistItem;
  handlers: ChecklistShortcutHandlers;
}

export function GoalRow({ item, handlers }: Readonly<GoalRowProps>) {
  const [expanded, setExpanded] = useState(false);
  const active = activeStep(item);
  const isDone = item.state === 'COMPLETE';

  // x/y = which milestone step you're ON (1-based position) over the total.
  const milestones = (item.steps ?? []).filter((s) => s.kind === 'MILESTONE');
  const position = active ? milestones.findIndex((s) => s.id === active.id) + 1 : 0;
  const total = milestones.length;

  return (
    <div className={cn('py-1.5', isDone && 'opacity-60')}>
      {/* Goal line — glyph centred with the label. The active step + disclosure sit indented
          beneath, under the label (not the glyph), so the glyph reads as the goal's status. */}
      <div className="flex items-center gap-3">
        <GoalGlyph item={item} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{item.label}</span>
      </div>

      <div className="ml-[1.8rem]">
        {active && <ActiveStepLine step={active} position={position} total={total} handlers={handlers} />}

        {(item.steps?.length ?? 0) > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-1.5 flex items-center gap-1 text-xs text-muted hover:text-foreground"
            aria-expanded={expanded}
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {expanded ? 'Hide steps' : 'See all steps'}
          </button>
        )}

        {expanded && <StepsList item={item} activeId={active?.id} />}
      </div>
    </div>
  );
}
