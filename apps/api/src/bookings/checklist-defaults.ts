export interface DueDateRule {
  basis: 'bookingDate' | 'bookingCreation';
  offsetDays: number;
}

// A milestone step of a multi-step goal (ADR-0057). The goal (the user-facing row)
// owns ordered steps along the deliverable spine; each step carries the predicate
// that auto-completes it. v1 ships `kind: 'MILESTONE'` only. The step `key` is the
// goal's *unique* flat-template key (e.g. `send_contract`), NOT a bare `send`, so the
// flat predicate registry (a `Record<stepKey, …>`) can never collide — the locked
// precedent for #608's deposit/balance steps.
export interface ChecklistDefaultStep {
  key: string;
  label: string;
  kind: 'MILESTONE' | 'PRECONDITION' | 'FOLLOWUP';
  // How the step reaches COMPLETE — the musician acting now (ACTION) or awaiting an
  // external event (AWAITED). Orthogonal to `completedBy`: a CUSTOMER-completed step
  // is AWAITED. Drives the surfacing omission (passive client waits never nag).
  completeMode: 'ACTION' | 'AWAITED';
  completedBy: 'USER' | 'CUSTOMER' | 'BAND_MEMBER';
  autoCompleteRule: Record<string, unknown> | null;
  // Carried for FOLLOWUP-step anchoring (a later increment); v1 steps have no
  // materialised dueDate column — the surfaced deadline lives on the goal.
  dueDateRule?: DueDateRule | null;
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
  // ADR-0057: a multi-step goal owns ordered steps and has `autoCompleteRule: null`
  // (its state rolls up from its steps). An atomic goal has no `steps` and carries its
  // own rule. Present on the contract goal (v1); deposit/balance/song-requests follow.
  steps?: ChecklistDefaultStep[];
}

export const CHECKLIST_DEFAULTS: ChecklistDefaultItem[] = [
  {
    // ADR-0057 / #616: the quote deliverable as one multi-step goal — send the quote → the
    // client accepts it. Mirrors the contract goal: the goal carries no rule (its state rolls
    // up from its steps), `completedBy: USER` so it passes the findActionItems USER filter
    // (surfacing then refines to the active step), and a goal-level dueDate of bookingCreation+2
    // (the send deadline, the quote's binding deadline). `quote_accepted` is AWAITED with no
    // system signal (a quote acceptance has no portal event), so it completes by the musician
    // marking the goal done — the locked precedent for a USER-awaited step with no rule. It is
    // USER-completedBy, so per the chase-the-money policy the goal keeps surfacing (chase the
    // sale) until the booking advances past PROVISIONAL.
    key: 'get_the_quote_accepted',
    label: 'Get the quote accepted',
    completedBy: 'USER',
    dependsOn: [],
    autoCompleteRule: null,
    requiredForStatus: 'PROVISIONAL',
    dueDateRule: { basis: 'bookingCreation', offsetDays: 2 },
    steps: [
      // PRECONDITIONS (#618), ordered before the first send — surfaced one at a time, each folds the
      // moment its predicate holds (same predicate across goals ⇒ all co-resolve once satisfied).
      {
        key: 'set_fee_quote',
        label: 'Set the booking fee',
        kind: 'PRECONDITION',
        completeMode: 'ACTION',
        completedBy: 'USER',
        autoCompleteRule: { type: 'bookingField', field: 'fee', operator: 'notNull' },
      },
      {
        key: 'add_email_quote',
        label: "Add the client's email",
        kind: 'PRECONDITION',
        completeMode: 'ACTION',
        completedBy: 'USER',
        autoCompleteRule: { type: 'customerEmail' },
      },
      {
        key: 'send_quote',
        label: 'Send the quote',
        kind: 'MILESTONE',
        completeMode: 'ACTION',
        completedBy: 'USER',
        autoCompleteRule: { type: 'communicationSent', templateTypes: ['quote'] },
        dueDateRule: { basis: 'bookingCreation', offsetDays: 2 },
      },
      {
        key: 'quote_accepted',
        label: 'Client accepts the quote',
        kind: 'MILESTONE',
        completeMode: 'AWAITED',
        completedBy: 'USER',
        autoCompleteRule: null,
      },
    ],
  },
  {
    // ADR-0057 / #608 / #617: the deposit billing deliverable as one multi-step goal — create the
    // invoice → issue it → send it to the client → the deposit lands. Mirrors the contract goal:
    // the goal carries no rule (state rolls up from its steps), `completedBy: USER` so it passes
    // the findActionItems USER filter (surfacing then refines to the active step), and a goal-level
    // dueDate of -30 (the received deadline — the latest the cluster dates against, so the goal
    // keeps surfacing through the awaited deposit). #617 splits create from issue: a saved draft
    // completes `create_deposit_invoice` (includeDraft) and surfaces `issue_deposit_invoice` as the
    // active step (the #585 fix made explicit); the draft → issue hop itself is owned by the
    // invoice sheet (ADR-0056 / dec.11), which the checklist shadows as two distinct steps.
    key: 'get_deposit_paid',
    label: 'Get the deposit paid',
    completedBy: 'USER',
    dependsOn: [],
    autoCompleteRule: null,
    requiredForStatus: 'CONFIRMED',
    dueDateRule: { basis: 'bookingDate', offsetDays: -30 },
    steps: [
      // PRECONDITIONS (#618), ordered before the first action.
      {
        key: 'set_fee_deposit',
        label: 'Set the booking fee',
        kind: 'PRECONDITION',
        completeMode: 'ACTION',
        completedBy: 'USER',
        autoCompleteRule: { type: 'bookingField', field: 'fee', operator: 'notNull' },
      },
      {
        key: 'add_email_deposit',
        label: "Add the client's email",
        kind: 'PRECONDITION',
        completeMode: 'ACTION',
        completedBy: 'USER',
        autoCompleteRule: { type: 'customerEmail' },
      },
      {
        // ADR-0057 / #617: the create milestone — satisfied by a draft-or-beyond invoice
        // (includeDraft), so saving a draft advances the goal and surfaces "Issue" as what's left
        // rather than leaving the musician dangling. The draft → issue hop is owned by the invoice
        // sheet (ADR-0056 / dec.11); the checklist shadows both as distinct steps.
        key: 'create_deposit_invoice',
        label: 'Create deposit invoice',
        kind: 'MILESTONE',
        completeMode: 'ACTION',
        completedBy: 'USER',
        autoCompleteRule: { type: 'invoiceExists', isDeposit: true, includeDraft: true },
      },
      {
        // The issue milestone — invoiceExists WITHOUT includeDraft, so a DRAFT does not satisfy it
        // (the #585 fix: a created-but-unissued draft keeps "Issue the invoice" surfaced).
        key: 'issue_deposit_invoice',
        label: 'Issue deposit invoice',
        kind: 'MILESTONE',
        completeMode: 'ACTION',
        completedBy: 'USER',
        autoCompleteRule: { type: 'invoiceExists', isDeposit: true },
      },
      {
        // The outbound send. The deposit usually ships on the contract email
        // (`contract_and_deposit_cover`), so sending that one email completes both this and
        // the contract goal's send step; a standalone `deposit_invoice_cover` also satisfies it.
        key: 'send_deposit_invoice',
        label: 'Send deposit invoice',
        kind: 'MILESTONE',
        completeMode: 'ACTION',
        completedBy: 'USER',
        autoCompleteRule: {
          type: 'communicationSent',
          templateTypes: ['deposit_invoice_cover', 'contract_and_deposit_cover'],
        },
      },
      {
        // AWAITED: an external payment lands; the USER only records it (via the booking's
        // depositReceivedAt, set by the mark-deposit-received action). completedBy USER, so it
        // still surfaces to the musician (chase / record) — unlike a CUSTOMER-awaited step.
        key: 'deposit_received',
        label: 'Deposit received',
        kind: 'MILESTONE',
        completeMode: 'AWAITED',
        completedBy: 'USER',
        autoCompleteRule: { type: 'bookingField', field: 'depositReceivedAt', operator: 'notNull' },
        dueDateRule: { basis: 'bookingDate', offsetDays: -30 },
      },
    ],
  },
  {
    // ADR-0057 / #607: the first multi-step goal. "Get the contract signed" is the
    // outcome; the system sequences create → send → signed beneath it. The goal carries
    // no rule (its state rolls up from the steps) and a goal-level dueDate of -60 days —
    // the *send* deadline, the first hard musician deadline, which is what surfacing
    // dates against while create/send is the active step (the signing step is CUSTOMER /
    // AWAITED, so never surfaces to the musician). `completedBy: USER` so the goal passes
    // the findActionItems USER filter; surfacing then refines by the active step.
    key: 'get_contract_signed',
    label: 'Get the contract signed',
    completedBy: 'USER',
    dependsOn: [],
    autoCompleteRule: null,
    requiredForStatus: 'CONFIRMED',
    dueDateRule: { basis: 'bookingDate', offsetDays: -60 },
    steps: [
      // PRECONDITIONS (#618), ordered before drafting/sending.
      {
        key: 'set_fee_contract',
        label: 'Set the booking fee',
        kind: 'PRECONDITION',
        completeMode: 'ACTION',
        completedBy: 'USER',
        autoCompleteRule: { type: 'bookingField', field: 'fee', operator: 'notNull' },
      },
      {
        key: 'add_email_contract',
        label: "Add the client's email",
        kind: 'PRECONDITION',
        completeMode: 'ACTION',
        completedBy: 'USER',
        autoCompleteRule: { type: 'customerEmail' },
      },
      {
        key: 'create_contract',
        label: 'Draft the contract',
        kind: 'MILESTONE',
        completeMode: 'ACTION',
        completedBy: 'USER',
        autoCompleteRule: { type: 'bookingField', field: 'activeContract', operator: 'notNull' },
      },
      {
        key: 'send_contract',
        label: 'Send it to the client',
        kind: 'MILESTONE',
        completeMode: 'ACTION',
        completedBy: 'USER',
        autoCompleteRule: { type: 'communicationSent', templateTypes: ['contract_cover', 'contract_and_deposit_cover'] },
        dueDateRule: { basis: 'bookingDate', offsetDays: -60 },
      },
      {
        key: 'contract_signed',
        label: 'Client signs the contract',
        kind: 'MILESTONE',
        completeMode: 'AWAITED',
        completedBy: 'CUSTOMER',
        autoCompleteRule: { type: 'contractSigned' },
        dueDateRule: { basis: 'bookingDate', offsetDays: -45 },
      },
    ],
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
    // ADR-0057 / #608 / #617: the balance billing deliverable as one multi-step goal, now
    // outcome-framed as "Get the balance paid" (symmetry with get_deposit_paid): create → issue →
    // send → balance received. Goal carries no rule (rolls up), dates against -14 (the send
    // deadline). #617 splits create from issue (the #585 fix, mirrors the deposit) and adds a
    // USER-awaited `balance_received` step. There is no `balanceReceivedAt` field (out of scope —
    // the analytics cash-received lens), so `balance_received` reads the balance invoice's PAID
    // status directly (#653 `invoicePaid`); being USER-awaited it keeps surfacing (chase the money)
    // until paid, and its "Mark as paid" action marks the sent balance invoice paid.
    key: 'get_the_balance_paid',
    label: 'Get the balance paid',
    completedBy: 'USER',
    dependsOn: [],
    autoCompleteRule: null,
    requiredForStatus: 'READY',
    dueDateRule: { basis: 'bookingDate', offsetDays: -14 },
    steps: [
      // PRECONDITIONS (#618), ordered before the first action.
      {
        key: 'set_fee_balance',
        label: 'Set the booking fee',
        kind: 'PRECONDITION',
        completeMode: 'ACTION',
        completedBy: 'USER',
        autoCompleteRule: { type: 'bookingField', field: 'fee', operator: 'notNull' },
      },
      {
        key: 'add_email_balance',
        label: "Add the client's email",
        kind: 'PRECONDITION',
        completeMode: 'ACTION',
        completedBy: 'USER',
        autoCompleteRule: { type: 'customerEmail' },
      },
      {
        // Create milestone — a draft-or-beyond invoice (includeDraft).
        key: 'create_balance_invoice',
        label: 'Create balance invoice',
        kind: 'MILESTONE',
        completeMode: 'ACTION',
        completedBy: 'USER',
        autoCompleteRule: { type: 'invoiceExists', isDeposit: false, includeDraft: true },
      },
      {
        // Issue milestone — a non-DRAFT invoice (the #585 fix).
        key: 'issue_balance_invoice',
        label: 'Issue balance invoice',
        kind: 'MILESTONE',
        completeMode: 'ACTION',
        completedBy: 'USER',
        autoCompleteRule: { type: 'invoiceExists', isDeposit: false },
      },
      {
        // The outbound send that pairs with the issue step (#586). Auto-completes when a
        // balance_invoice_cover email is sent.
        key: 'send_balance_invoice',
        label: 'Send balance invoice',
        kind: 'MILESTONE',
        completeMode: 'ACTION',
        completedBy: 'USER',
        autoCompleteRule: { type: 'communicationSent', templateTypes: ['balance_invoice_cover'] },
        dueDateRule: { basis: 'bookingDate', offsetDays: -14 },
      },
      {
        // AWAITED, USER-completedBy — the musician records the payment. Auto-completes when the
        // balance invoice is PAID (#653); its "Mark as paid" CTA marks the sent balance invoice paid.
        key: 'balance_received',
        label: 'Balance received',
        kind: 'MILESTONE',
        completeMode: 'AWAITED',
        completedBy: 'USER',
        autoCompleteRule: { type: 'invoicePaid', isDeposit: false },
      },
    ],
  },
  {
    // ADR-0057 / #608: the song-requests deliverable as one multi-step goal — invite the client
    // to the music form → they respond with their requests. Goal carries no rule (rolls up),
    // `completedBy: USER` so the goal passes the findActionItems filter while the invite is the
    // active step; once invited, the goal goes quiet — the response step is CUSTOMER/AWAITED, a
    // legitimate passive client wait (never nags). Dates against -30 (the invite, the earliest
    // musician-actionable deadline in the cluster).
    key: 'gather_song_requests',
    label: 'Gather song requests',
    completedBy: 'USER',
    dependsOn: [],
    autoCompleteRule: null,
    requiredForStatus: 'READY',
    dueDateRule: { basis: 'bookingDate', offsetDays: -30 },
    steps: [
      // #533 / #630: set up and publish the form first — this makes it client-visible and mirrors
      // the invoice create → issue → send shape. Ordered before `add_email_music` because
      // publishing needs no client email (only *sending the invite* does), so the precondition
      // gates the invite, not the whole goal. Auto-completes on publish; reverts on un-publish.
      {
        key: 'set_up_and_publish',
        label: 'Set up and publish the music form',
        kind: 'MILESTONE',
        completeMode: 'ACTION',
        completedBy: 'USER',
        autoCompleteRule: { type: 'musicFormPublished' },
      },
      // PRECONDITION (#618): emailing the music-form invite needs the client's email. Ordered
      // immediately before the invite (after publish) so it gates the send, not publication. No fee
      // precondition — the music form is not part of the deal/billing spine.
      {
        key: 'add_email_music',
        label: "Add the client's email",
        kind: 'PRECONDITION',
        completeMode: 'ACTION',
        completedBy: 'USER',
        autoCompleteRule: { type: 'customerEmail' },
      },
      {
        key: 'music_form_invite',
        label: 'Send music form invite',
        kind: 'MILESTONE',
        completeMode: 'ACTION',
        completedBy: 'USER',
        autoCompleteRule: { type: 'communicationSent', templateTypes: ['music_form_invite'] },
      },
      {
        key: 'song_requests',
        label: 'Song requests received',
        kind: 'MILESTONE',
        completeMode: 'AWAITED',
        completedBy: 'CUSTOMER',
        autoCompleteRule: { type: 'musicFormResponse' },
        dueDateRule: { basis: 'bookingDate', offsetDays: -14 },
      },
    ],
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
