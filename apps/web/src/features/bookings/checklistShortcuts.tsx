// Shared shortcut routing for checklist rows (ADR-0057). An atomic goal carries its shortcut on
// the item; a multi-step goal carries it on the *active step* (#611). Both resolve through the one
// `resolveChecklistShortcut` map here so there is a single place that turns a `shortcutType` into a
// click handler — the active step routes to the owning sheet exactly like an atomic item does.

export type ChecklistAction = 'create_deposit_invoice' | 'create_balance_invoice' | 'create_contract';
export type MarkDoneKey = 'mark_contract_signed' | 'mark_deposit_received';

export interface ChecklistShortcutHandlers {
  onOpenCompose: (templateType?: string) => void;
  onChecklistAction: (action: ChecklistAction) => void;
  onMarkDone: (key: MarkDoneKey) => void;
  onDeepLink: (section: string) => void;
  isActionPending: boolean;
}

// Structural setup items (PRD #511 Module D) have no shortcut action — their "done" state is
// auto-completed from data. Their action instead deep-links into the Builder at the relevant step
// so the musician resolves the prompt in context (Story 25, #525).
export const STRUCTURAL_BUILDER_SECTION: Record<string, string> = {
  build_itinerary: 'itinerary',
  add_venue: 'venue',
};

export interface ResolvedShortcut {
  label: string;
  pendingLabel?: string;
  pending: boolean;
  onClick: () => void;
}

// Resolve a shortcutType (+ item key, for structural deep-links) to a labelled click handler.
// Returns null when there is no known action — the caller decides the fallback (atomic rows fall
// back to a manual "Mark done"; an active step with no shortcut renders informationally).
export function resolveChecklistShortcut(
  args: { shortcutType?: string; shortcutTemplateType?: string; itemKey?: string | null; isFailed: boolean },
  h: ChecklistShortcutHandlers,
): ResolvedShortcut | null {
  const { shortcutType, shortcutTemplateType, itemKey, isFailed } = args;
  const retry = isFailed ? 'Retry' : undefined;

  const builderSection = itemKey ? STRUCTURAL_BUILDER_SECTION[itemKey] : undefined;
  if (builderSection) {
    return { label: retry ?? 'Set up', pending: false, onClick: () => h.onDeepLink(builderSection) };
  }
  if (shortcutType === 'send_email') {
    return { label: retry ?? 'Send', pending: false, onClick: () => h.onOpenCompose(shortcutTemplateType) };
  }
  if (
    shortcutType === 'create_contract' ||
    shortcutType === 'create_deposit_invoice' ||
    shortcutType === 'create_balance_invoice'
  ) {
    return {
      label: retry ?? 'Create',
      pendingLabel: 'Creating…',
      pending: h.isActionPending,
      onClick: () => h.onChecklistAction(shortcutType as ChecklistAction),
    };
  }
  // ADR-0057 / #617: the issue step routes through the SAME create-invoice handler — it opens the
  // saved draft on the invoice sheet so the musician issues it there (the sheet owns create→issue).
  // Only the label differs ("Issue" vs "Create").
  if (shortcutType === 'issue_deposit_invoice' || shortcutType === 'issue_balance_invoice') {
    const createAction: ChecklistAction =
      shortcutType === 'issue_deposit_invoice' ? 'create_deposit_invoice' : 'create_balance_invoice';
    return {
      label: retry ?? 'Issue',
      pendingLabel: 'Issuing…',
      pending: h.isActionPending,
      onClick: () => h.onChecklistAction(createAction),
    };
  }
  if (shortcutType === 'mark_contract_signed' || shortcutType === 'mark_deposit_received') {
    return {
      label: retry ?? 'Mark done',
      pendingLabel: 'Marking…',
      pending: h.isActionPending,
      onClick: () => h.onMarkDone(shortcutType as MarkDoneKey),
    };
  }
  return null;
}
