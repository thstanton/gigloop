import type { Meta, StoryObj } from '@storybook/react';
import { StatusPill } from './StatusPill';

const meta: Meta<typeof StatusPill> = {
  title: 'Common/StatusPill',
  component: StatusPill,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof StatusPill>;

export const Confirmed: Story = {
  args: {
    label: 'Confirmed',
    bg: 'bg-status-confirmed/12',
    text: 'text-status-confirmed',
    border: 'border-l-status-confirmed',
  },
};

export const Cancelled: Story = {
  args: {
    label: 'Cancelled',
    bg: 'bg-status-cancelled/12',
    text: 'text-status-cancelled',
    border: 'border-l-status-cancelled',
  },
};

export const Enquiry: Story = {
  args: {
    label: 'Enquiry',
    bg: 'bg-status-enquiry/12',
    text: 'text-status-enquiry',
    border: 'border-l-status-enquiry',
  },
};

export const Muted: Story = {
  args: {
    label: 'Void',
    bg: 'bg-muted/40',
    text: 'text-muted',
    border: 'border-l-muted',
  },
};
