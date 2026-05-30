import type { Meta, StoryObj } from '@storybook/react';
import InvoiceStatusPill from './InvoiceStatusPill';

const meta: Meta<typeof InvoiceStatusPill> = {
  title: 'Common/InvoiceStatusPill',
  component: InvoiceStatusPill,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof InvoiceStatusPill>;

export const Draft: Story = { args: { status: 'DRAFT' } };
export const Sent: Story = { args: { status: 'SENT' } };
export const Paid: Story = { args: { status: 'PAID' } };
export const Overdue: Story = { args: { status: 'SENT', isOverdue: true } };
export const Void: Story = { args: { status: 'VOID' } };
