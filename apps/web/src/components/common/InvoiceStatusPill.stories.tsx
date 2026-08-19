import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import type { InvoiceStatus } from '@/types/api';
import InvoiceStatusPill from './InvoiceStatusPill';

const meta: Meta<typeof InvoiceStatusPill> = {
  title: 'Common/InvoiceStatusPill',
  component: InvoiceStatusPill,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof InvoiceStatusPill>;

export const Draft: Story = { args: { status: 'DRAFT' } };
export const Issued: Story = { args: { status: 'ISSUED' } };
export const Sent: Story = { args: { status: 'SENT' } };
export const Paid: Story = { args: { status: 'PAID' } };
export const Overdue: Story = { args: { status: 'SENT', isOverdue: true } };
export const Void: Story = { args: { status: 'VOID' } };

const ALL_STATUSES: InvoiceStatus[] = ['DRAFT', 'ISSUED', 'SENT', 'PAID', 'VOID'];

export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      {ALL_STATUSES.map((status) => (
        <InvoiceStatusPill key={status} status={status} />
      ))}
      <InvoiceStatusPill status="SENT" isOverdue />
    </div>
  ),
};

/**
 * Primary use case: every invoice status, plus the overdue override, renders a
 * labelled pill carrying a tint class.
 *
 * Note what this deliberately does NOT assert. #784 — the bug this story
 * accompanies — was two well-formed background classes naming palette tokens
 * that do not exist (the literal strings are on the issue; they are kept out of
 * this file so #810's source scan cannot mistake them for live usage). They
 * landed in the DOM and type-checked, but generated no CSS rule at all, so the
 * pills rendered bare with black text on white. Only
 * a resolved-colour check could tell that apart from a live token, and this
 * suite runs on `happy-dom` (see `vitest.config.ts`), which implements no CSS
 * cascade and no `var()` resolution — every `getComputedStyle` value comes back
 * empty. A computed-style assertion here would pass vacuously and read as
 * coverage it does not have.
 *
 * The dead-class guard is therefore #810's build-time scan, by necessity rather
 * than preference. This story covers rendering and the tint-class shape only.
 */
export const PrimaryUseCase: Story = {
  ...AllStatuses,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    for (const label of ['Draft', 'Issued', 'Sent', 'Paid', 'Void', 'Overdue']) {
      const pill = canvas.getByText(label);
      await expect(pill).toBeInTheDocument();
      // Shape, not value: a tint is applied. Which token it names is the
      // component's declaration, not something a test should restate.
      await expect(pill.className).toMatch(/\bbg-(status-|muted)/);
    }
  },
};
