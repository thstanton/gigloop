import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { BandCommsComposeSheet } from './BandCommsComposeSheet';
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

const templates = [
  {
    id: '00000000-0000-4000-8000-000000000011',
    name: 'Band call sheet email',
    builtInType: 'band_call_sheet',
    content: { type: 'doc', content: [] },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000012',
    name: 'Band call sheet message',
    builtInType: 'band_call_sheet_message',
    content: { type: 'doc', content: [] },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000013',
    name: 'Band final details email',
    builtInType: 'band_final_details',
    content: { type: 'doc', content: [] },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000014',
    name: 'Band final details message',
    builtInType: 'band_final_details_message',
    content: { type: 'doc', content: [] },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const callSheetTemplates = templates.slice(0, 2);
const callSheetRender = {
  subject: 'Call sheet — 2026-09-15',
  body: '<p>Hi Dave, your call sheet is ready.</p>',
  missingVariables: [],
};
const callSheetMessage = {
  body: 'Call sheet: https://app.gigloop.com/band/member-token',
  missingVariables: [],
};

const requests: {
  callSheetSend?: Record<string, unknown>;
  communication?: Record<string, unknown>;
  statusUpdate?: Record<string, unknown>;
  finalDetailsSend?: Record<string, unknown>;
} = {};

const meta = {
  component: BandCommsComposeSheet,
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
    kind: 'call-sheet',
    open: true,
    onOpenChange: fn(),
  },
} satisfies Meta<typeof BandCommsComposeSheet>;

function InteractiveSheetStory(args: React.ComponentProps<typeof BandCommsComposeSheet>) {
  const [open, setOpen] = React.useState(args.open);
  return (
    <BandCommsComposeSheet
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

const callSheetHandlers = [
  http.get('/api/templates', () => HttpResponse.json(callSheetTemplates)),
  http.get('/api/bookings/booking-1/band-members/member-1/call-sheet/render', () => HttpResponse.json(callSheetRender)),
  http.get('/api/bookings/booking-1/band-members/member-1/call-sheet/message/render', () => HttpResponse.json(callSheetMessage)),
  http.post('/api/bookings/booking-1/band-members/member-1/call-sheet/send', async ({ request }) => {
    requests.callSheetSend = await request.json() as Record<string, unknown>;
    return new HttpResponse(null, { status: 204 });
  }),
  http.post('/api/bookings/booking-1/communications', async ({ request }) => {
    requests.communication = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ id: 'communication-1' }, { status: 201 });
  }),
  http.patch('/api/bookings/booking-1/band-members/member-1', async ({ request }) => {
    requests.statusUpdate = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ id: 'member-1' });
  }),
];

export const CallSheetAttachmentAndEmailSend: Story = {
  render: (args) => <InteractiveSheetStory {...args} />,
  parameters: { msw: { handlers: callSheetHandlers } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    requests.callSheetSend = undefined;
    await expect(canvas.findByText('Email includes call sheet PDF')).resolves.toBeVisible();
    const sendButton = await canvas.findByRole('button', { name: 'Send email' });
    await waitFor(async () => expect(sendButton).toBeEnabled());
    await userEvent.setup().click(sendButton);
    await waitFor(() => expect(requests.callSheetSend).toEqual({
      templateId: templates[0].id,
      subject: callSheetRender.subject,
      body: callSheetRender.body,
    }));
    await expect(canvas.findByText('Call sheet sent')).resolves.toBeVisible();
  },
};

export const CopyWorksWithoutEmail: Story = {
  args: { member: { ...member, contact: { ...member.contact, email: null } } },
  render: (args) => <InteractiveSheetStory {...args} />,
  parameters: { msw: { handlers: callSheetHandlers } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    const previewNavigator = canvasElement.ownerDocument.defaultView!.navigator;
    const previousClipboard = Object.getOwnPropertyDescriptor(previewNavigator, 'clipboard');
    Object.defineProperty(previewNavigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => undefined },
    });
    try {
      await expect(canvas.findByText('No email address on file for Dave Jones. Add one to send by email.')).resolves.toBeVisible();
      await expect(canvas.findByRole('button', { name: 'Send email' })).resolves.toBeDisabled();
      const copyButton = await canvas.findByRole('button', { name: 'Copy message' });
      await waitFor(async () => expect(copyButton).toBeEnabled());
      await userEvent.setup().click(copyButton);
      await expect(canvas.findByText('Call sheet copied')).resolves.toBeVisible();
      await expect(canvas.findByRole('button', { name: 'Mark as sent' })).resolves.toBeVisible();
    } finally {
      if (previousClipboard) Object.defineProperty(previewNavigator, 'clipboard', previousClipboard);
      else Reflect.deleteProperty(previewNavigator, 'clipboard');
    }
  },
};

export const CopyAndMarkAsSentLogsManualWithoutChangingStatus: Story = {
  render: (args) => <InteractiveSheetStory {...args} />,
  parameters: { msw: { handlers: callSheetHandlers } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    requests.communication = undefined;
    requests.statusUpdate = undefined;
    const previewNavigator = canvasElement.ownerDocument.defaultView!.navigator;
    const previousClipboard = Object.getOwnPropertyDescriptor(previewNavigator, 'clipboard');
    Object.defineProperty(previewNavigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => undefined },
    });
    try {
      const copyButton = await canvas.findByRole('button', { name: 'Copy message' });
      await waitFor(async () => expect(copyButton).toBeEnabled());
      await userEvent.setup().click(copyButton);
      await userEvent.setup().click(await canvas.findByRole('button', { name: 'Mark as sent' }));
      await waitFor(() => expect(requests.communication).toEqual({
        contactId: 'contact-1',
        subject: templates[1].name,
        body: callSheetMessage.body,
        templateId: templates[1].id,
        channel: 'MANUAL',
      }));
      expect(requests.statusUpdate).toBeUndefined();
    } finally {
      if (previousClipboard) Object.defineProperty(previewNavigator, 'clipboard', previousClipboard);
      else Reflect.deleteProperty(previewNavigator, 'clipboard');
    }
  },
};

export const FinalDetailsHasNoAttachment: Story = {
  args: { kind: 'final-details' },
  parameters: {
    msw: {
      handlers: [
        http.get('/api/templates', () => HttpResponse.json(templates.slice(2))),
        http.get('/api/bookings/booking-1/band-members/member-1/final-details/render', () => HttpResponse.json({
          subject: 'Final details — 2026-09-15', body: '<p>See you soon.</p>', missingVariables: [],
        })),
        http.get('/api/bookings/booking-1/band-members/member-1/final-details/message/render', () => HttpResponse.json({
          body: 'Final details: https://app.gigloop.com/band/member-token', missingVariables: [],
        })),
        http.post('/api/bookings/booking-1/band-members/member-1/final-details/send', async ({ request }) => {
          requests.finalDetailsSend = await request.json() as Record<string, unknown>;
          return new HttpResponse(null, { status: 204 });
        }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    requests.finalDetailsSend = undefined;
    await expect(canvas.findByText('Compose final details')).resolves.toBeVisible();
    await expect(canvas.queryByText('Email includes call sheet PDF')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Email includes attachment')).not.toBeInTheDocument();
    const sendButton = await canvas.findByRole('button', { name: 'Send email' });
    await waitFor(async () => expect(sendButton).toBeEnabled());
    await userEvent.setup().click(sendButton);
    await waitFor(() => expect(requests.finalDetailsSend).toEqual({
      templateId: templates[2].id,
      subject: 'Final details — 2026-09-15',
      body: '<p>See you soon.</p>',
    }));
    await expect(canvas.findByText('Final details sent')).resolves.toBeVisible();
  },
};
