import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { BandInviteComposeSheet } from './BandInviteComposeSheet';
import type { BookingBandMember } from '@/types/api';

const member: BookingBandMember = {
  id: 'member-1',
  contactId: 'contact-1',
  contact: { id: 'contact-1', name: 'Dave Jones', email: 'dave@example.com' },
  bandPortalToken: 'member-token',
  status: 'ADDED',
  isSelf: false,
  sessionFee: null,
  invitedAt: null,
  respondedAt: null,
};

const inviteTemplate = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Band invitation email',
  builtInType: 'band_invite',
  content: { type: 'doc', content: [] },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const renderResult = {
  subject: 'You’re invited to play — 2026-09-15',
  body: '<p>Hi Dave Jones, please accept in your band portal.</p>',
  missingVariables: [],
};

const meta = {
  component: BandInviteComposeSheet,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
  args: {
    bookingId: 'booking-1',
    member,
    open: true,
    onOpenChange: () => {},
  },
} satisfies Meta<typeof BandInviteComposeSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

const renderHandlers = [
  http.get('/api/templates', () => HttpResponse.json([inviteTemplate])),
  http.get('/api/bookings/booking-1/band-members/member-1/invite/render', () => HttpResponse.json(renderResult)),
  http.post('/api/bookings/booking-1/band-members/member-1/invite/send', () => new HttpResponse(null, { status: 204 })),
];

export const MemberWithEmail: Story = {
  parameters: { msw: { handlers: renderHandlers } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await waitFor(async () => {
      await expect(canvas.findByText('Dave Jones')).resolves.toBeVisible();
      await expect(canvas.findByText('(dave@example.com)')).resolves.toBeVisible();
      await expect(canvas.findByRole('button', { name: 'Send invitation' })).resolves.toBeEnabled();
    });
    await expect(canvas.findByText('Calendar invitation attached')).resolves.toBeVisible();
  },
};

export const MemberWithoutEmail: Story = {
  args: {
    member: { ...member, contact: { ...member.contact, email: null } },
  },
  parameters: { msw: { handlers: renderHandlers } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await expect(canvas.findByText('No email address on file for Dave Jones. Add one before sending.')).resolves.toBeVisible();
    await expect(canvas.findByRole('button', { name: 'Send invitation' })).resolves.toBeDisabled();
  },
};
