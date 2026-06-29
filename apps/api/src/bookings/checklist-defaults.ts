export interface DueDateRule {
  basis: 'bookingDate' | 'bookingCreation';
  offsetDays: number;
}

export interface ChecklistDefaultItem {
  key: string;
  label: string;
  completedBy: 'USER' | 'CUSTOMER' | 'BAND_MEMBER';
  dependsOn: string[];
  autoCompleteRule: Record<string, unknown> | null;
  requiredForStatus: 'PROVISIONAL' | 'CONFIRMED' | 'READY' | 'COMPLETE' | null;
  dueDateRule: DueDateRule | null;
  enabled?: boolean;
  // Per-concern grouping (ADR-0052). System defaults resolve their concern from the
  // static concern map, so this is left unset for them; a custom global-template item
  // carries its user-chosen concern here so it appears in that section on every booking.
  concern?: string | null;
}

export const CHECKLIST_DEFAULTS: ChecklistDefaultItem[] = [
  {
    key: 'send_quote',
    label: 'Send quote',
    completedBy: 'USER',
    dependsOn: [],
    autoCompleteRule: { type: 'communicationSent', templateTypes: ['quote'] },
    requiredForStatus: 'PROVISIONAL',
    dueDateRule: { basis: 'bookingCreation', offsetDays: 2 },
  },
  {
    key: 'confirm_quote',
    label: 'Quote confirmed',
    completedBy: 'USER',
    dependsOn: ['send_quote'],
    autoCompleteRule: null,
    requiredForStatus: 'PROVISIONAL',
    dueDateRule: null,
  },
  {
    key: 'create_deposit_invoice',
    label: 'Issue deposit invoice',
    completedBy: 'USER',
    dependsOn: ['confirm_quote'],
    autoCompleteRule: { type: 'invoiceExists', isDeposit: true },
    requiredForStatus: 'CONFIRMED',
    dueDateRule: null,
  },
  {
    key: 'create_contract',
    label: 'Create contract',
    completedBy: 'USER',
    dependsOn: ['confirm_quote'],
    autoCompleteRule: { type: 'bookingField', field: 'activeContract', operator: 'notNull' },
    requiredForStatus: 'CONFIRMED',
    dueDateRule: null,
  },
  {
    key: 'send_contract',
    label: 'Send contract & deposit email',
    completedBy: 'USER',
    dependsOn: ['create_contract'],
    autoCompleteRule: { type: 'communicationSent', templateTypes: ['contract_cover', 'contract_and_deposit_cover'] },
    requiredForStatus: 'CONFIRMED',
    dueDateRule: { basis: 'bookingDate', offsetDays: -60 },
  },
  {
    key: 'contract_signed',
    label: 'Contract signed',
    completedBy: 'CUSTOMER',
    dependsOn: ['send_contract'],
    autoCompleteRule: { type: 'contractSigned' },
    requiredForStatus: 'CONFIRMED',
    dueDateRule: { basis: 'bookingDate', offsetDays: -45 },
  },
  {
    key: 'deposit_received',
    label: 'Deposit received',
    completedBy: 'USER',
    dependsOn: ['send_contract'],
    autoCompleteRule: { type: 'bookingField', field: 'depositReceivedAt', operator: 'notNull' },
    requiredForStatus: 'CONFIRMED',
    dueDateRule: { basis: 'bookingDate', offsetDays: -30 },
  },
  {
    // Structural setup item (PRD #511 Module D): auto-completes when a venue is chosen.
    // Binds to the venue completeness predicate (Module A) via the `completeness` rule —
    // never re-checks `venueId` independently. READY-staged (operational prep) and a
    // disablable default, like every seeded item.
    key: 'add_venue',
    label: 'Add venue',
    completedBy: 'USER',
    dependsOn: [],
    autoCompleteRule: { type: 'completeness', concern: 'venue' },
    requiredForStatus: 'READY',
    dueDateRule: null,
  },
  {
    // Structural setup item (PRD #511 Module D / #523): auto-completes when sets exist.
    // Binds to the itinerary completeness predicate (Module A) — isConcernComplete returns
    // true for any non-empty state (partial or set), so a booking with template-seeded sets
    // never sees this as a PENDING nag (Story 21: never nag work already done).
    key: 'build_itinerary',
    label: 'Build itinerary',
    completedBy: 'USER',
    dependsOn: [],
    autoCompleteRule: { type: 'completeness', concern: 'itinerary' },
    requiredForStatus: 'READY',
    dueDateRule: null,
  },
  {
    key: 'create_balance_invoice',
    label: 'Issue balance invoice',
    completedBy: 'USER',
    dependsOn: [],
    autoCompleteRule: { type: 'invoiceExists', isDeposit: false },
    requiredForStatus: 'READY',
    dueDateRule: { basis: 'bookingDate', offsetDays: -14 },
  },
  {
    // The outbound send that pairs with create_balance_invoice (#586). Auto-completes when a
    // balance_invoice_cover email is sent; until then it sits as an advisory READY reminder.
    // Auto-completion is at DRAFT level (it depends on the create item's invoiceExists), which
    // is acceptable for an advisory checklist.
    key: 'send_balance_invoice',
    label: 'Send balance invoice',
    completedBy: 'USER',
    dependsOn: ['create_balance_invoice'],
    autoCompleteRule: { type: 'communicationSent', templateTypes: ['balance_invoice_cover'] },
    requiredForStatus: 'READY',
    dueDateRule: { basis: 'bookingDate', offsetDays: -14 },
  },
  {
    key: 'music_form_invite',
    label: 'Send music form invite',
    completedBy: 'USER',
    dependsOn: [],
    autoCompleteRule: { type: 'communicationSent', templateTypes: ['music_form_invite'] },
    requiredForStatus: 'READY',
    dueDateRule: { basis: 'bookingDate', offsetDays: -30 },
  },
  {
    key: 'song_requests',
    label: 'Song requests received',
    completedBy: 'CUSTOMER',
    dependsOn: ['music_form_invite'],
    autoCompleteRule: { type: 'musicFormResponse' },
    requiredForStatus: 'READY',
    dueDateRule: { basis: 'bookingDate', offsetDays: -14 },
  },
  {
    key: 'play_the_gig',
    label: 'Play the gig',
    completedBy: 'USER',
    dependsOn: [],
    autoCompleteRule: null,
    requiredForStatus: 'COMPLETE',
    dueDateRule: { basis: 'bookingDate', offsetDays: 0 },
  },
  {
    key: 'send_thank_you',
    label: 'Send thank you',
    completedBy: 'USER',
    dependsOn: ['play_the_gig'],
    autoCompleteRule: { type: 'communicationSent', templateTypes: ['thank_you'] },
    requiredForStatus: 'COMPLETE',
    dueDateRule: { basis: 'bookingDate', offsetDays: 7 },
  },
];

export function computeDueDate(
  rule: DueDateRule | null,
  bookingDate: Date,
  bookingCreatedAt: Date,
): Date | null {
  if (!rule) return null;
  const base = new Date(rule.basis === 'bookingDate' ? bookingDate : bookingCreatedAt);
  base.setDate(base.getDate() + rule.offsetDays);
  return base;
}

// The `order` to assign an on-demand-seeded reminder (ADR-0052 / PRD #538 Module 4)
// so it lands in template (workflow) position rather than appended. The caller shifts
// every existing item with `order >= this value` by +1 before inserting, so the new
// item slots exactly after the last existing item that precedes it in the template
// (or first, if none precede it). Custom items (no template index) never count as
// "preceding" but are carried along by the shift, preserving their relative order.
export function computeReminderInsertOrder(
  key: string,
  existingItems: Array<{ key: string | null; order: number }>,
): number {
  const templateIndex = (k: string | null): number =>
    k === null ? -1 : CHECKLIST_DEFAULTS.findIndex((d) => d.key === k);
  const newIdx = templateIndex(key);
  const precedingOrders = existingItems
    .filter((i) => {
      const idx = templateIndex(i.key);
      return idx !== -1 && idx < newIdx;
    })
    .map((i) => i.order);
  return precedingOrders.length ? Math.max(...precedingOrders) + 1 : 1;
}

export function getChecklistDefaults(
  preferences: Record<string, unknown> | null | undefined,
): ChecklistDefaultItem[] {
  const defaults = (preferences as { checklistDefaults?: ChecklistDefaultItem[] } | null)
    ?.checklistDefaults;
  if (Array.isArray(defaults) && defaults.length > 0) return defaults;
  return CHECKLIST_DEFAULTS;
}

// Stage order for seeding rule: items at stages AT OR BEFORE the booking's starting
// status are not seeded (they've already happened outside the system).
const STAGE_ORDER: Array<ChecklistDefaultItem['requiredForStatus']> = [
  null,
  'PROVISIONAL',
  'CONFIRMED',
  'READY',
  'COMPLETE',
];

// Map BookingStatus to its checklist stage equivalent
const BOOKING_STATUS_TO_STAGE: Record<string, ChecklistDefaultItem['requiredForStatus']> = {
  ENQUIRY: null,
  PROVISIONAL: 'PROVISIONAL',
  CONFIRMED: 'CONFIRMED',
  READY: 'READY',
  COMPLETE: 'COMPLETE',
  CANCELLED: 'COMPLETE',
};

export function filterItemsByStartingStatus(
  items: ChecklistDefaultItem[],
  startingStatus: string,
): ChecklistDefaultItem[] {
  const startingStage = BOOKING_STATUS_TO_STAGE[startingStatus] ?? null;
  const startingIndex = STAGE_ORDER.indexOf(startingStage);

  return items.filter((item) => {
    if (item.enabled === false) return false;
    const itemStageIndex = STAGE_ORDER.indexOf(item.requiredForStatus);
    return itemStageIndex > startingIndex;
  });
}
