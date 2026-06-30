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
  args: { handlers: handlers() },
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
