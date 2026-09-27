import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
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

const inviteMessageTemplate = {
  ...inviteTemplate,
  id: '00000000-0000-4000-8000-000000000002',
  name: 'Band invitation message',
  builtInType: 'band_invite_message',
};

const renderResult = {
  subject: 'You’re invited to play — 2026-09-15',
  body: '<p>Hi Dave Jones, please accept in your band portal.</p>',
  missingVariables: [],
};

const messageRenderResult = {
  body: 'Invitation: https://app.gigloop.com/band/member-token\nFor 2026-09-15 — please reply there.',
  missingVariables: [],
};

const requests: { communication?: Record<string, unknown>; status?: Record<string, unknown> } = {};

const meta = {
  component: BandInviteComposeSheet,
  tags: ['ai-generated'],
  decorators: [(Story) => (
    <MemoryRouter>
      <Story />
      <Toaster />
    </MemoryRouter>
  )],
  args: {
    bookingId: 'booking-1',
    member,
    open: true,
    onOpenChange: fn(),
  },
} satisfies Meta<typeof BandInviteComposeSheet>;

function InteractiveSheetStory(args: React.ComponentProps<typeof BandInviteComposeSheet>) {
  const [open, setOpen] = React.useState(args.open);
  return (
    <BandInviteComposeSheet
      {...args}
      open={open}
      onOpenChange={(nextOpen) => {
        args.onOpenChange(nextOpen);
        setOpen(nextOpen);
      }}
    />
  );
}

export default meta;
type Story = StoryObj<typeof meta>;

const renderHandlers = [
  http.get('/api/templates', () => HttpResponse.json([inviteTemplate, inviteMessageTemplate])),
  http.get('/api/bookings/booking-1/band-members/member-1/invite/render', () => HttpResponse.json(renderResult)),
  http.get('/api/bookings/booking-1/band-members/member-1/invite/message/render', () => HttpResponse.json(messageRenderResult)),
  http.post('/api/bookings/booking-1/band-members/member-1/invite/send', () => new HttpResponse(null, { status: 204 })),
  http.post('/api/bookings/booking-1/communications', async ({ request }) => {
    requests.communication = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ id: 'communication-1' }, { status: 201 });
  }),
  http.patch('/api/bookings/booking-1/band-members/member-1', async ({ request }) => {
    requests.status = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ id: 'member-1', status: 'INVITED' });
  }),
];

export const MemberWithEmail: Story = {
  parameters: { msw: { handlers: renderHandlers } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await waitFor(async () => {
      await expect(canvas.findByText('Dave Jones')).resolves.toBeVisible();
      await expect(canvas.findByText('(dave@example.com)')).resolves.toBeVisible();
      await expect(canvas.findByRole('button', { name: 'Send email' })).resolves.toBeEnabled();
    });
      await expect(canvas.findByText('Email includes calendar invitation')).resolves.toBeVisible();
  },
};

export const MemberWithoutEmail: Story = {
  args: {
    member: { ...member, contact: { ...member.contact, email: null } },
  },
  render: (args) => <InteractiveSheetStory {...args} />,
  parameters: { msw: { handlers: renderHandlers } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await expect(canvas.findByText('No email address on file for Dave Jones. Add one to send by email.')).resolves.toBeVisible();
    await expect(canvas.findByRole('button', { name: 'Send email' })).resolves.toBeDisabled();
    const user = userEvent.setup();
    const previousClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    let copiedText = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => { copiedText = text; } },
    });
    try {
      const copyButton = await canvas.findByRole('button', { name: 'Copy message' });
      await waitFor(async () => expect(copyButton).toBeEnabled());
      await user.click(copyButton);
      expect(copiedText).toBe(messageRenderResult.body);
      await expect(args.onOpenChange).toHaveBeenCalledWith(false);
      await waitFor(() => expect(canvas.queryByRole('dialog')).not.toBeInTheDocument());
      await expect(canvas.findByRole('button', { name: 'Mark as sent' })).resolves.toBeVisible();
    } finally {
      if (previousClipboard) Object.defineProperty(navigator, 'clipboard', previousClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  },
};

export const CopyInvitationAndMarkAsSent: Story = {
  render: (args) => <InteractiveSheetStory {...args} />,
  parameters: { msw: { handlers: renderHandlers } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    requests.communication = undefined;
    requests.status = undefined;
    const user = userEvent.setup();
    const previousClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    let copiedText = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => { copiedText = text; } },
    });
    try {
      const emailButton = await canvas.findByRole('button', { name: 'Send email' });
      await waitFor(async () => expect(emailButton).toBeEnabled());
      const copyButton = await canvas.findByRole('button', { name: 'Copy message' });
      expect(copyButton.className).toBe(emailButton.className);
      await waitFor(async () => expect(copyButton).toBeEnabled());
      await user.click(copyButton);
      await expect(canvas.findByText('Invitation copied')).resolves.toBeVisible();
      expect(copiedText).toBe(messageRenderResult.body);
      await expect(args.onOpenChange).toHaveBeenCalledWith(false);
      await waitFor(() => expect(canvas.queryByRole('dialog')).not.toBeInTheDocument());

      await user.click(await canvas.findByRole('button', { name: 'Mark as sent' }));
      await waitFor(() => expect(requests.communication).toEqual({
        contactId: 'contact-1',
        subject: 'Band invitation message',
        body: messageRenderResult.body,
        templateId: inviteMessageTemplate.id,
        channel: 'MANUAL',
      }));
      expect(requests.status).toEqual({ status: 'INVITED' });
    } finally {
      if (previousClipboard) Object.defineProperty(navigator, 'clipboard', previousClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  },
};

export const ClipboardFailureOffersManualCopy: Story = {
  parameters: { msw: { handlers: renderHandlers } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    const user = userEvent.setup();
    const previousClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => { throw new Error('clipboard denied'); } },
    });
    try {
      const copyButton = await canvas.findByRole('button', { name: 'Copy message' });
      await waitFor(async () => expect(copyButton).toBeEnabled());
      await user.click(copyButton);
      await expect(canvas.findByText('Select and copy this message manually:')).resolves.toBeVisible();
      await expect(canvas.findByRole('textbox', { name: 'Invitation message to copy manually' })).resolves.toHaveValue(messageRenderResult.body);
    } finally {
      if (previousClipboard) Object.defineProperty(navigator, 'clipboard', previousClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  },
};
