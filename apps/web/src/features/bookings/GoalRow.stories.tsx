import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { GoalRow } from './GoalRow';
import type { ChecklistItem, ChecklistStep } from '@/types/api';
import type { ChecklistShortcutHandlers } from './checklistShortcuts';

function step(overrides: Partial<ChecklistStep> & { id: string; label: string }): ChecklistStep {
  return {
    key: overrides.id,
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
  args: { handlers: handlers(), onSetState: fn() },
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
    // An AWAITED active step shows as a muted wait — no CTA button for it.
    await expect(canvas.getByText(/Waiting on the client/)).toBeVisible();
    await expect(canvas.queryByRole('button', { name: /Client signs the contract/ })).toBeNull();
    await expect(canvas.getByText('3/3')).toBeVisible();
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
