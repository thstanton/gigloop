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

// Invoice-step shortcuts → the create-invoice handler. Create and issue (ADR-0057 / #617) both
// route to onChecklistAction — the issue step opens the saved draft on the sheet to issue it there
// (the sheet owns the create→issue hop); only the label differs.
const INVOICE_ACTION: Record<string, { action: ChecklistAction; label: string; pendingLabel: string }> = {
  create_contract: { action: 'create_contract', label: 'Create', pendingLabel: 'Creating…' },
  create_deposit_invoice: { action: 'create_deposit_invoice', label: 'Create', pendingLabel: 'Creating…' },
  create_balance_invoice: { action: 'create_balance_invoice', label: 'Create', pendingLabel: 'Creating…' },
  issue_deposit_invoice: { action: 'create_deposit_invoice', label: 'Issue', pendingLabel: 'Issuing…' },
  issue_balance_invoice: { action: 'create_balance_invoice', label: 'Issue', pendingLabel: 'Issuing…' },
};

// PRECONDITION CTAs (#618) deep-link to the Builder section where the prerequisite is fixed — the
// fee on Overview, the client's email on People (where the customer is managed).
const PRECONDITION_DEEP_LINK: Record<string, { label: string; section: string }> = {
  set_fee: { label: 'Set the fee', section: 'overview' },
  add_email: { label: 'Add email', section: 'people' },
};

const MARK_DONE_KEYS = new Set<string>(['mark_contract_signed', 'mark_deposit_received']);

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
  if (!shortcutType) return null;

  if (shortcutType === 'send_email') {
    return { label: retry ?? 'Send', pending: false, onClick: () => h.onOpenCompose(shortcutTemplateType) };
  }
  const invoice = INVOICE_ACTION[shortcutType];
  if (invoice) {
    return {
      label: retry ?? invoice.label,
      pendingLabel: invoice.pendingLabel,
      pending: h.isActionPending,
      onClick: () => h.onChecklistAction(invoice.action),
    };
  }
  const precondition = PRECONDITION_DEEP_LINK[shortcutType];
  if (precondition) {
    return { label: retry ?? precondition.label, pending: false, onClick: () => h.onDeepLink(precondition.section) };
  }
  // #533 / #630: the set_up_and_publish step deep-links to the Builder's Music section, where the
  // Save draft / Publish controls live (same deep-link pattern as the structural/precondition rows).
  if (shortcutType === 'set_up_and_publish_music') {
    return { label: retry ?? 'Set up & publish', pending: false, onClick: () => h.onDeepLink('music') };
  }
  if (MARK_DONE_KEYS.has(shortcutType)) {
    return {
      label: retry ?? 'Mark done',
      pendingLabel: 'Marking…',
      pending: h.isActionPending,
      onClick: () => h.onMarkDone(shortcutType as MarkDoneKey),
    };
  }
  return null;
}
