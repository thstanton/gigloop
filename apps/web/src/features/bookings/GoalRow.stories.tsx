import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { GoalRow } from './GoalRow';
import type { ChecklistItem, ChecklistStep } from '@/types/api';
import type { ChecklistShortcutHandlers } from './checklistShortcuts';

function step(overrides: Partial<ChecklistStep> & { id: string; label: string }): ChecklistStep {
  return {
    key: overrides.id,
    bandMemberId: null,
    order: 0,
    kind: 'MILESTONE',
    completeMode: 'ACTION',
    state: 'PENDING',
    completedBy: 'USER',
    completedAt: null,
    autoCompleteRule: null,
    ...overrides,
  };
}

function contractGoal(steps: ChecklistStep[]): ChecklistItem {
  return {
    id: 'g-contract',
    createdAt: '2030-01-01T00:00:00Z',
    updatedAt: '2030-01-01T00:00:00Z',
    bookingId: 'b1',
    key: 'get_contract_signed',
    label: 'Get the contract signed',
    completedBy: 'USER',
    state: 'PENDING',
    order: 1,
    autoCompleteRule: null,
    requiredForStatus: 'CONFIRMED',
    completedAt: null,
    dueDate: null,
    dueDateRule: null,
    concern: 'overview',
    steps,
  };
}

const draft = step({ id: 's-create', label: 'Draft the contract', order: 1 });
const send = step({
  id: 's-send',
  label: 'Send it to the client',
  order: 2,
  shortcutType: 'send_email',
  shortcutTemplateType: 'contract_cover',
});
const signed = step({
  id: 's-signed',
  label: 'Client signs the contract',
  order: 3,
  completeMode: 'AWAITED',
  completedBy: 'CUSTOMER',
});

function handlers(): ChecklistShortcutHandlers {
  return {
    onOpenCompose: fn(),
    onChecklistAction: fn(),
    onMarkDone: fn(),
    onDeepLink: fn(),
    isActionPending: false,
  };
}

const meta = {
  component: GoalRow,
  tags: ['ai-generated'],
  args: { handlers: handlers(), onSetState: fn(), clientName: 'Jamie' },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof GoalRow>;

export default meta;
type Story = StoryObj<typeof meta>;

// Create done, Send is the active step (an ACTION the musician resolves now), Signing awaits.
export const ActiveActionStep: Story = {
  args: {
    item: contractGoal([{ ...draft, state: 'COMPLETE', completedAt: '2030-01-02T00:00:00Z' }, send, signed]),
    handlers: handlers(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // The active step is surfaced as the wand-led CTA, with the "step 2 of 3" position count.
    await expect(canvas.getByRole('button', { name: /Send it to the client/ })).toBeVisible();
    await expect(canvas.getByText('2/3')).toBeVisible();

    // Steps fold by default; "See all steps" reveals the completed + upcoming steps.
    await expect(canvas.queryByText('Draft the contract')).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: /See all steps/ }));
    await expect(canvas.getByText('Draft the contract')).toBeVisible();
    await expect(canvas.getByText('Client signs the contract')).toBeVisible();

    // The active step routes to its owning sheet (Send → compose).
    await userEvent.click(canvas.getByRole('button', { name: /Send it to the client/ }));
    await expect(args.handlers.onOpenCompose).toHaveBeenCalledWith('contract_cover');
  },
};

// Create + Send done; the goal now awaits the client's signature — informational, not actionable.
export const AwaitingClient: Story = {
  args: {
    item: contractGoal([
      { ...draft, state: 'COMPLETE' },
      { ...send, state: 'COMPLETE' },
      signed,
    ]),
    handlers: handlers(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // An AWAITED active step shows as a muted wait — no CTA button for it. #634: the client is
    // named by their greeting name (meta clientName = 'Jamie').
    await expect(canvas.getByText(/Waiting on Jamie/)).toBeVisible();
    await expect(canvas.queryByRole('button', { name: /Client signs the contract/ })).toBeNull();
    await expect(canvas.getByText('3/3')).toBeVisible();
  },
};

// #634: with no client name resolvable (no greeting name and no full name), the wait falls back to
// the generic "the client".
export const AwaitingClientNoName: Story = {
  args: {
    item: contractGoal([
      { ...draft, state: 'COMPLETE' },
      { ...send, state: 'COMPLETE' },
      signed,
    ]),
    handlers: handlers(),
    clientName: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Waiting on the client/)).toBeVisible();
  },
};

// ── Quote goal (#616): send → accept, mirroring the contract but USER-awaited at the end ──────

function quoteGoal(steps: ChecklistStep[]): ChecklistItem {
  return {
    ...contractGoal(steps),
    id: 'g-quote',
    key: 'get_the_quote_accepted',
    label: 'Get the quote accepted',
    requiredForStatus: 'PROVISIONAL',
  };
}

function bandGoal(steps: ChecklistStep[]): ChecklistItem {
  return {
    ...contractGoal(steps),
    id: 'g-band',
    key: 'get_the_band_confirmed',
    label: 'Get the band confirmed',
    requiredForStatus: 'READY',
  };
}

// #901: the two-days-out worklist — a COMPLETE-staged sibling of the READY-staged confirmation goal.
function briefedGoal(steps: ChecklistStep[]): ChecklistItem {
  return {
    ...contractGoal(steps),
    id: 'g-brief',
    key: 'get_the_band_briefed',
    label: 'Get the band briefed',
    requiredForStatus: 'COMPLETE',
  };
}

const sendQuote = step({
  id: 's-send-quote',
  label: 'Send the quote',
  order: 1,
  shortcutType: 'send_email',
  shortcutTemplateType: 'quote',
});
const quoteAccepted = step({
  id: 's-quote-accepted',
  label: 'Client accepts the quote',
  order: 2,
  completeMode: 'AWAITED',
  completedBy: 'USER', // chase the sale — the musician marks it, no client portal signal
});

// Send is the active ACTION step — the wand-led CTA routes to compose with the quote template.
export const QuoteActiveSend: Story = {
  args: { item: quoteGoal([sendQuote, quoteAccepted]), handlers: handlers() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: /Send the quote/ })).toBeVisible();
    await expect(canvas.getByText('1/2')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: /Send the quote/ }));
    await expect(args.handlers.onOpenCompose).toHaveBeenCalledWith('quote');
  },
};

// Sent; now awaiting acceptance. Because the awaited step is USER-completedBy (not the client),
// it shows as a plain muted wait with NO "Waiting on …" party, and the musician resolves it via
// the goal's "Mark complete" — the precedent for a USER-awaited step with no system signal.
export const QuoteAwaitingAcceptance: Story = {
  args: {
    item: quoteGoal([{ ...sendQuote, state: 'COMPLETE' }, quoteAccepted]),
    handlers: handlers(),
    onSetState: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Client accepts the quote')).toBeVisible();
    // USER-awaited ⇒ no "Waiting on the client" suffix (that is only for CUSTOMER/BAND waits).
    await expect(canvas.queryByText(/Waiting on/)).toBeNull();
    await expect(canvas.getByText('2/2')).toBeVisible();
    // Resolved by marking the goal complete (no system signal for a quote acceptance).
    await userEvent.click(canvas.getByRole('button', { name: 'More actions' }), { pointerEventsCheck: 0 });
    await userEvent.click(await within(document.body).findByText('Mark complete'), { pointerEventsCheck: 0 });
    await expect(args.onSetState).toHaveBeenCalledWith('g-quote', 'COMPLETE');
  },
};

// ── Precondition steps (#618): block a goal until the fee/email is set; CTA deep-links ────────

// The lineup has been chosen, but every part is still vacant.
export const BandAllVacant: Story = {
  args: {
    item: bandGoal([
      step({ id: 's-lineup', key: 'choose_a_lineup', label: 'Choose a lineup', order: 1, kind: 'PRECONDITION', state: 'COMPLETE' }),
      step({ id: 's-fill', key: 'fill_every_chair', label: 'Fill every chair', order: 2, kind: 'PRECONDITION', shortcutType: 'open_band' }),
    ]),
    handlers: handlers(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Fill every chair' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Fill every chair' }));
    await expect(args.handlers.onDeepLink).toHaveBeenCalledWith('band');
  },
};

// Dave's invite is sent; his confirmation is the active named chase, followed by Sam's pair.
export const BandMidInvite: Story = {
  args: {
    item: bandGoal([
      step({ id: 's-lineup', key: 'choose_a_lineup', label: 'Choose a lineup', order: 1, kind: 'PRECONDITION', state: 'COMPLETE' }),
      step({ id: 's-fill', key: 'fill_every_chair', label: 'Fill every chair', order: 2, kind: 'PRECONDITION', state: 'COMPLETE' }),
      step({ id: 's-invite-dave', key: 'invite_band_member', bandMemberId: 'm-dave', label: 'Invite Dave', order: 3, state: 'COMPLETE' }),
      step({ id: 's-confirm-dave', key: 'band_member_confirmed', bandMemberId: 'm-dave', label: 'Dave confirms', order: 4, completeMode: 'AWAITED', completedBy: 'BAND_MEMBER', shortcutType: 'band_member' }),
      step({ id: 's-invite-sam', key: 'invite_band_member', bandMemberId: 'm-sam', label: 'Invite Sam', order: 5 }),
      step({ id: 's-confirm-sam', key: 'band_member_confirmed', bandMemberId: 'm-sam', label: 'Sam confirms', order: 6, completeMode: 'AWAITED', completedBy: 'BAND_MEMBER', shortcutType: 'band_member' }),
    ]),
    handlers: handlers(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Chase Dave' })).toBeVisible();
    await expect(canvas.getByText('2/4')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Chase Dave' }));
    await expect(args.handlers.onDeepLink).toHaveBeenCalledWith('band');
  },
};

// A declined answer stays visible as history, while the vacancy re-opens the fill precondition.
export const BandOneDeclined: Story = {
  args: {
    item: bandGoal([
      step({ id: 's-lineup', key: 'choose_a_lineup', label: 'Choose a lineup', order: 1, kind: 'PRECONDITION', state: 'COMPLETE' }),
      step({ id: 's-fill', key: 'fill_every_chair', label: 'Fill every chair', order: 2, kind: 'PRECONDITION', shortcutType: 'open_band' }),
      step({ id: 's-invite-dave', key: 'invite_band_member', bandMemberId: 'm-dave', label: 'Invite Dave', order: 3, state: 'COMPLETE' }),
      step({ id: 's-confirm-dave', key: 'band_member_confirmed', bandMemberId: 'm-dave', label: 'Dave confirms', order: 4, state: 'DECLINED', completeMode: 'AWAITED', completedBy: 'BAND_MEMBER', shortcutType: 'band_member' }),
      step({ id: 's-invite-sam', key: 'invite_band_member', bandMemberId: 'm-sam', label: 'Invite Sam', order: 5 }),
      step({ id: 's-confirm-sam', key: 'band_member_confirmed', bandMemberId: 'm-sam', label: 'Sam confirms', order: 6, completeMode: 'AWAITED', completedBy: 'BAND_MEMBER', shortcutType: 'band_member' }),
    ]),
    handlers: handlers(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Fill every chair' })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Chase Dave' })).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: /See all steps/ }));
    const declined = canvas.getByText('Dave confirms');
    await expect(declined).toHaveClass('line-through');
    await expect(declined.closest('li')?.querySelector('svg')).toHaveClass('text-muted');
  },
};

// #901: once everyone has said yes, the briefing worklist names the next person to send final
// details to. Dave's went by copy-paste + Mark as sent; Sam is next.
export const BandBriefingWorklist: Story = {
  args: {
    item: briefedGoal([
      step({ id: 's-brief-dave', key: 'brief_band_member', bandMemberId: 'm-dave', label: 'Brief Dave', order: 1, state: 'COMPLETE', shortcutType: 'brief_band_member' }),
      step({ id: 's-brief-sam', key: 'brief_band_member', bandMemberId: 'm-sam', label: 'Brief Sam', order: 2, shortcutType: 'brief_band_member' }),
    ]),
    handlers: handlers(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Get the band briefed')).toBeVisible();
    await expect(canvas.getByText('2/2')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Brief Sam' }));
    await expect(args.handlers.onDeepLink).toHaveBeenCalledWith('band');
    // No call-sheet step: the call sheet is a push, never a chase (ADR-0073).
    await userEvent.click(canvas.getByRole('button', { name: /See all steps/ }));
    await expect(canvas.queryByText(/call sheet/i)).toBeNull();
  },
};

// #901: a bounced final-details email keeps the person-named CTA so the musician can resend.
export const BandBriefingFailed: Story = {
  args: {
    item: briefedGoal([
      step({ id: 's-brief-dave', key: 'brief_band_member', bandMemberId: 'm-dave', label: 'Brief Dave', order: 1, state: 'FAILED', shortcutType: 'brief_band_member' }),
    ]),
    handlers: handlers(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Brief Dave' }));
    await expect(args.handlers.onDeepLink).toHaveBeenCalledWith('band');
  },
};

const setFeeQuote = step({ id: 's-set-fee', label: 'Set the booking fee', order: 1, kind: 'PRECONDITION', shortcutType: 'set_fee' });
const addEmailQuote = step({ id: 's-add-email', label: "Add the client's email", order: 2, kind: 'PRECONDITION', shortcutType: 'add_email' });

// An unsatisfied precondition leads the goal as the active step; its CTA deep-links to the booking
// (the fee on Overview). Preconditions aren't milestones, so no x/y progress count is shown.
export const PreconditionActive: Story = {
  args: {
    item: quoteGoal([setFeeQuote, addEmailQuote, sendQuote, quoteAccepted]),
    handlers: handlers(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: /Set the booking fee/ })).toBeVisible();
    await expect(canvas.queryByText('1/2')).toBeNull(); // preconditions excluded from the ring count
    await userEvent.click(canvas.getByRole('button', { name: /Set the booking fee/ }));
    await expect(args.handlers.onDeepLink).toHaveBeenCalledWith('overview');
  },
};

// ── Invoice goals (#617): create → issue → send → received, create/issue distinct CTAs ────────

function depositGoal(steps: ChecklistStep[]): ChecklistItem {
  return { ...contractGoal(steps), id: 'g-deposit', key: 'get_deposit_paid', label: 'Get the deposit paid' };
}

const createDeposit = step({ id: 's-create-dep', label: 'Create deposit invoice', order: 1, shortcutType: 'create_deposit_invoice' });
const issueDeposit = step({ id: 's-issue-dep', label: 'Issue deposit invoice', order: 2, shortcutType: 'issue_deposit_invoice' });
const sendDeposit = step({ id: 's-send-dep', label: 'Send deposit invoice', order: 3, shortcutType: 'send_email', shortcutTemplateType: 'deposit_invoice_cover' });
const depositReceived = step({ id: 's-dep-recv', label: 'Deposit received', order: 4, completeMode: 'AWAITED', completedBy: 'USER' });

// No invoice yet — "Create" is the active step (opens the invoice sheet to draft).
export const DepositCreateActive: Story = {
  args: { item: depositGoal([createDeposit, issueDeposit, sendDeposit, depositReceived]), handlers: handlers() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: /Create deposit invoice/ })).toBeVisible();
    await expect(canvas.getByText('1/4')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: /Create deposit invoice/ }));
    await expect(args.handlers.onChecklistAction).toHaveBeenCalledWith('create_deposit_invoice');
  },
};

// A saved draft completes Create; "Issue the invoice" becomes the active step (the #585 fix). The
// issue CTA reuses the create-invoice handler — it opens the saved draft on the sheet to issue it.
export const DepositIssueActive: Story = {
  args: {
    item: depositGoal([{ ...createDeposit, state: 'COMPLETE' }, issueDeposit, sendDeposit, depositReceived]),
    handlers: handlers(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: /Issue deposit invoice/ })).toBeVisible();
    await expect(canvas.getByText('2/4')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: /Issue deposit invoice/ }));
    await expect(args.handlers.onChecklistAction).toHaveBeenCalledWith('create_deposit_invoice');
  },
};

// Create + issue + send done; the deposit is awaited. Though AWAITED, the step is USER-completedBy
// (the musician records the payment), so it still gets an action CTA — "Mark as paid" (#653), which
// marks the sent invoice paid via onMarkDone. The button reads "Mark as paid", not the step's
// outcome label ("Deposit received").
export const DepositReceivedMarkPaid: Story = {
  args: {
    item: depositGoal([
      { ...createDeposit, state: 'COMPLETE' },
      { ...issueDeposit, state: 'COMPLETE' },
      { ...sendDeposit, state: 'COMPLETE' },
      { ...depositReceived, shortcutType: 'mark_deposit_received' },
    ]),
    handlers: handlers(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // The awaited-but-USER step surfaces as a wand CTA labelled by the action, not the outcome.
    await expect(canvas.getByRole('button', { name: 'Mark as paid' })).toBeVisible();
    await expect(canvas.queryByText(/Waiting on/)).toBeNull();
    await expect(canvas.getByText('4/4')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Mark as paid' }));
    await expect(args.handlers.onMarkDone).toHaveBeenCalledWith('mark_deposit_received');
  },
};

// ── Atomic goals (no steps), unified into the same row in #610 ──────────────────────────────

function atomicGoal(overrides: Partial<ChecklistItem>): ChecklistItem {
  return { ...contractGoal([]), key: null, label: 'Bring spare strings', steps: [], ...overrides };
}

// A custom goal with no shortcut — the musician marks it complete by hand.
export const AtomicManual: Story = {
  args: { item: atomicGoal({}), handlers: handlers(), onSetState: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Mark complete' }));
    await expect(args.onSetState).toHaveBeenCalledWith('g-contract', 'COMPLETE');
  },
};

// A structural goal — its action deep-links into the Builder ("Set up").
export const AtomicStructural: Story = {
  args: { item: atomicGoal({ key: 'add_venue', label: 'Add the venue' }), handlers: handlers(), onSetState: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Set up' }));
    await expect(args.handlers.onDeepLink).toHaveBeenCalledWith('venue');
  },
};

// The overflow menu (RowActions: bottom sheet on mobile, popover on desktop) carries the opt-out
// levers: Skip sets the goal SKIPPED (reversible via Restore). Drives the desktop popover here.
export const KebabSkip: Story = {
  args: { item: atomicGoal({}), handlers: handlers(), onSetState: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'More actions' }), { pointerEventsCheck: 0 });
    const menu = within(document.body);
    await userEvent.click(await menu.findByText('Skip'), { pointerEventsCheck: 0 });
    await expect(args.onSetState).toHaveBeenCalledWith('g-contract', 'SKIPPED');
  },
};

// An overdue goal surfaces its due/overdue cue inline on the goal line (right of the label).
export const Overdue: Story = {
  args: { item: atomicGoal({ dueDate: '2020-01-01T00:00:00Z' }), handlers: handlers(), onSetState: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/overdue/)).toBeVisible();
  },
};

// A skipped goal is dimmed and set aside, its glyph a skip marker; the menu offers Restore.
export const Skipped: Story = {
  args: { item: atomicGoal({ state: 'SKIPPED' }), handlers: handlers(), onSetState: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Bring spare strings')).toBeVisible();
    // No action CTA is offered on a set-aside goal.
    await expect(canvas.queryByRole('button', { name: 'Mark complete' })).toBeNull();
  },
};

// ── DECLINED (#899, ADR-0057 amended by ADR-0074 §5): "the answer arrived, expectedly, and it
// was no." Declared generally here — not band-specific (#900 is its first real producer) — and
// exercised on a plain 3-step goal to prove the mechanism, not a band narrative.
function genericGoal(steps: ChecklistStep[]): ChecklistItem {
  return { ...contractGoal(steps), id: 'g-generic', key: null, label: 'Line up the extras' };
}

const askA = step({ id: 's-ask-a', label: 'Ask musician A', order: 1, state: 'COMPLETE' });
const askB = step({ id: 's-ask-b', label: 'Ask musician B', order: 2, state: 'DECLINED' });
const askC = step({ id: 's-ask-c', label: 'Ask musician C', order: 3 });

export const DeclinedStepExcludedFromProgress: Story = {
  args: { item: genericGoal([askA, askB, askC]), handlers: handlers() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // A declined step is terminal — never the active step. B is skipped over; C (still PENDING,
    // no shortcut wired) becomes the visible active line instead.
    await expect(canvas.getByText('Ask musician C')).toBeVisible();
    await expect(canvas.queryByText('Ask musician B')).toBeNull(); // folded, not yet revealed

    // The goal glyph's ring reads done=1/total=2 (A complete, C pending) — B must be excluded
    // from the total, not just the done count, or the ring (and the goal) could never complete
    // (#899's named failure mode). The ring carries no text, so this is asserted via the filled
    // circle's geometry rather than a hand-written expectation.
    const circles = canvasElement.querySelectorAll('circle');
    const fill = circles[1] as SVGCircleElement;
    const r = Number(fill.getAttribute('r'));
    const circumference = 2 * Math.PI * r;
    const expectedOffset = circumference * (1 - 1 / 2);
    await expect(Number(fill.getAttribute('stroke-dashoffset'))).toBeCloseTo(expectedOffset, 5);

    // Reveal the folded steps: B shows struck through, and its glyph pins the shared step-state
    // token — muted, same as a completed step, never FAILED's red.
    await userEvent.click(canvas.getByRole('button', { name: /See all steps/ }));
    const declinedLabel = canvas.getByText('Ask musician B');
    await expect(declinedLabel).toHaveClass('line-through');
    const declinedRow = declinedLabel.closest('li');
    const glyph = declinedRow?.querySelector('svg');
    await expect(glyph).toHaveClass('text-muted');
    await expect(glyph).not.toHaveClass('text-status-cancelled');
  },
};

// All steps complete — the goal rolls up to done (state COMPLETE), shown by the completed glyph.
export const Complete: Story = {
  args: {
    item: {
      ...contractGoal([
        { ...draft, state: 'COMPLETE' },
        { ...send, state: 'COMPLETE' },
        { ...signed, state: 'COMPLETE' },
      ]),
      state: 'COMPLETE',
    },
    handlers: handlers(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Get the contract signed')).toBeVisible();
    // No active step remains, so no CTA — the completed glyph carries the done state.
    await expect(canvas.queryByRole('button', { name: /Send it to the client/ })).toBeNull();
  },
};
