import type { Meta, StoryObj } from '@storybook/react';
import BookingStatusPill from './BookingStatusPill';

const meta: Meta<typeof BookingStatusPill> = {
  title: 'Common/BookingStatusPill',
  component: BookingStatusPill,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof BookingStatusPill>;

export const Enquiry: Story = { args: { status: 'ENQUIRY' } };
export const Provisional: Story = { args: { status: 'PROVISIONAL' } };
export const Confirmed: Story = { args: { status: 'CONFIRMED' } };
export const Ready: Story = { args: { status: 'READY' } };
export const Complete: Story = { args: { status: 'COMPLETE' } };
export const Cancelled: Story = { args: { status: 'CANCELLED' } };
