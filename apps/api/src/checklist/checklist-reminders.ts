// Module 2 — the applicable-reminders selector (pure; ADR-0052, PRD #538).
//
// Given a concern, the booking's checklist items, the booking's current status,
// and the user's globally-disabled system keys, returns the ordered list the
// per-concern "Remind me about" control renders. No DB access.
//
// The control's job is discovery + opt-out: it shows every reminder the booking
// has *not yet passed the stage for*, whether or not it has been seeded. So the
// output includes system reminders with no booking record yet (discoverable,
// on-demand seedable) alongside the ones already tracked or opted out.

import { CHECKLIST_DEFAULTS } from '../bookings/checklist-defaults';
import { concernForKey, keysForConcern, ReminderConcern } from './checklist-concerns';
import { isPastStage } from './checklist-surfacing';

// The booking checklist item fields the selector reads.
export interface ReminderItemInput {
  id: string;
  key: string | null;
  state: string;
  requiredForStatus: string | null;
  concern: string | null;
  label: string;
  order: number;
}

export interface ApplicableReminder {
  // The existing booking item, or null for a discoverable system reminder with no
  // record yet (turning it on triggers an on-demand seed).
  itemId: string | null;
  key: string | null;
  label: string;
  // Tracked (anything but SKIPPED) reads as on; SKIPPED or not-yet-seeded reads as off.
  on: boolean;
  source: 'system' | 'custom';
  // Lifecycle state of the existing item, or null when not yet seeded. Lets the
  // control show COMPLETE/BLOCKED/FAILED *within* the "on" state.
  state: string | null;
  requiredForStatus: string | null;
}

export interface SelectorContext {
  items: ReminderItemInput[];
  status: string;
  disabledKeys: Set<string>;
}

// Template (workflow) position of a system key — the canonical display order.
const TEMPLATE_INDEX: Record<string, number> = Object.fromEntries(
  CHECKLIST_DEFAULTS.map((d, idx) => [d.key, idx] as const),
);

function systemReminders(concern: ReminderConcern, ctx: SelectorContext): ApplicableReminder[] {
  const byKey = new Map(ctx.items.filter((i) => i.key).map((i) => [i.key as string, i]));

  return keysForConcern(concern)
    .map((key) => CHECKLIST_DEFAULTS.find((d) => d.key === key))
    .filter((d): d is (typeof CHECKLIST_DEFAULTS)[number] => d !== undefined)
    // Global master switch: a key disabled in Settings is never offered.
    .filter((d) => !ctx.disabledKeys.has(d.key))
    // Stage gate: only current-or-future reminders (past ones were system-retired).
    .filter((d) => !isPastStage(ctx.status, d.requiredForStatus))
    .map((d) => {
      const item = byKey.get(d.key);
      return {
        itemId: item?.id ?? null,
        key: d.key,
        label: d.label,
        on: item ? item.state !== 'SKIPPED' : false,
        source: 'system' as const,
        state: item?.state ?? null,
        requiredForStatus: d.requiredForStatus,
      };
    })
    .sort((a, b) => (TEMPLATE_INDEX[a.key as string] ?? 0) - (TEMPLATE_INDEX[b.key as string] ?? 0));
}

function customReminders(concern: ReminderConcern, ctx: SelectorContext): ApplicableReminder[] {
  return ctx.items
    // Custom = no key; concern-less customs are excluded from every concern.
    .filter((i) => !i.key && i.concern === concern)
    // Same stage gate as system items (a custom may carry a requiredForStatus).
    .filter((i) => !isPastStage(ctx.status, i.requiredForStatus))
    .sort((a, b) => a.order - b.order)
    .map((i) => ({
      itemId: i.id,
      key: null,
      label: i.label,
      on: i.state !== 'SKIPPED',
      source: 'custom' as const,
      state: i.state,
      requiredForStatus: i.requiredForStatus,
    }));
}

/**
 * The ordered reminders to render in a concern's "Remind me about" control:
 * system reminders in template (workflow) order, then concern-tagged custom items.
 */
export function selectApplicableReminders(
  concern: ReminderConcern,
  ctx: SelectorContext,
): ApplicableReminder[] {
  return [...systemReminders(concern, ctx), ...customReminders(concern, ctx)];
}

// Re-exported for callers that resolve a system item's concern (e.g. building the
// selector response for an item that carries a key).
export { concernForKey };
