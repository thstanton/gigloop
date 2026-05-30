import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import CommunicationsSection from './CommunicationsSection';
import type { Communication } from '@/types/api';

const contact = { id: 'c1', name: 'Jane Smith', email: 'jane@example.com', phone: null, address: null, notes: null, greetingName: 'Jane', primaryRole: 'CUSTOMER', parkingInfo: null, accessInfo: null, equipmentAvailable: null, website: null, commissionArrangement: null, createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z' };

const sentEmail: Communication = {
  id: 'cm1', createdAt: '2030-04-02T10:00:00Z', updatedAt: '2030-04-02T10:00:00Z',
  direction: 'OUTBOUND', channel: 'EMAIL', status: 'SENT',
  subject: 'Confirmation of your booking', body: '<p>Dear Jane, your booking is confirmed.</p>',
  sentAt: '2030-04-02T10:00:00Z', bookingId: 'b1', contactId: 'c1', contact,
  templateId: null, template: null,
};

const pendingEmail: Communication = {
  id: 'cm2', createdAt: '2030-04-03T09:00:00Z', updatedAt: '2030-04-03T09:00:00Z',
  direction: 'OUTBOUND', channel: 'EMAIL', status: 'PENDING',
  subject: 'Your invoice is attached', body: '<p>Please find your invoice attached.</p>',
  sentAt: null, bookingId: 'b1', contactId: 'c1', contact,
  templateId: null, template: null,
};

const failedEmail: Communication = {
  id: 'cm3', createdAt: '2030-04-04T08:00:00Z', updatedAt: '2030-04-04T08:00:00Z',
  direction: 'OUTBOUND', channel: 'EMAIL', status: 'FAILED',
  subject: 'Thank you for a wonderful evening', body: '<p>It was a pleasure to perform for you.</p>',
  sentAt: null, bookingId: 'b1', contactId: 'c1', contact,
  templateId: null, template: null,
};

const meta = {
  component: CommunicationsSection,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
  args: { onCompose: () => {} },
} satisfies Meta<typeof CommunicationsSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { communications: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No emails sent yet')).toBeVisible();
    await expect(canvas.getByText('Send email')).toBeVisible();
  },
};

export const WithSentEmail: Story = {
  args: { communications: [sentEmail] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Confirmation of your booking')).toBeVisible();
  },
};

export const WithPendingEmail: Story = {
  args: { communications: [pendingEmail] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Your invoice is attached')).toBeVisible();
  },
};

export const WithFailedEmail: Story = {
  args: { communications: [failedEmail] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Thank you for a wonderful evening')).toBeVisible();
    await expect(canvas.getByText(/Send failed/)).toBeVisible();
  },
};
