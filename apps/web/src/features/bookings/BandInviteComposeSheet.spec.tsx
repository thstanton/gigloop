import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BandInviteComposeSheet } from './BandInviteComposeSheet';
import type { BookingBandMember } from '@/types/api';

const { apiGet, apiPost, apiPatch, apiPostVoid, toast } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiPostVoid: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('@clerk/react', () => ({ useAuth: () => ({ isLoaded: true }) }));

vi.mock('@tiptap/react', () => ({
  useEditor: () => ({
    commands: { setContent: vi.fn() },
    getHTML: () => '<p>Invitation body</p>',
    destroy: vi.fn(),
    isDestroyed: false,
  }),
  EditorContent: () => null,
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: { children: ReactNode; open: boolean }) => (open ? <div>{children}</div> : null),
  SheetContent: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div>,
  SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/lib/api', () => ({ apiGet, apiPost, apiPatch, apiPostVoid }));
vi.mock('@/lib/hooks/use-toast', () => ({ toast }));

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
  content: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const inviteMessageTemplate = {
  ...inviteTemplate,
  id: '00000000-0000-4000-8000-000000000002',
  name: 'Band invitation message',
  builtInType: 'band_invite_message',
};

function renderSheet(currentMember = member) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <BandInviteComposeSheet bookingId="booking-1" member={currentMember} open onOpenChange={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe('BandInviteComposeSheet', () => {
  beforeEach(() => {
    apiGet.mockClear();
    apiPost.mockClear();
    apiPatch.mockClear();
    apiPostVoid.mockClear();
    toast.mockClear();
    apiGet.mockImplementation(async (url: string) => {
      if (url === '/templates') return [inviteTemplate, inviteMessageTemplate];
      if (url.includes('/invite/message/render')) {
        return { body: 'Invitation: https://app.gigloop.com/band/member-token', missingVariables: [] };
      }
      if (url.includes('/invite/render')) {
        return { subject: 'You’re invited — 2026-09-15', body: '<p>Invitation body</p>', missingVariables: [] };
      }
      throw new Error(`Unexpected GET ${url}`);
    });
    apiPost.mockResolvedValue({ id: 'communication-1' });
    apiPatch.mockResolvedValue({ id: 'member-1', status: 'INVITED' });
    apiPostVoid.mockResolvedValue(undefined);
  });

  it('shows a visible reason and disables email send when the member has no email', async () => {
    renderSheet({ ...member, contact: { ...member.contact, email: null } });

    expect(await screen.findByText('No email address on file for Dave Jones. Add one to send by email.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Send email' })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy message' })).toBeEnabled());
  });

  it('disables the send action and labels it Sending while the request is pending', async () => {
    let resolveSend!: () => void;
    apiPostVoid.mockReturnValue(new Promise<void>((resolve) => { resolveSend = resolve; }));
    renderSheet();
    const user = userEvent.setup({ pointerEventsCheck: 0 });

    const sendButton = await screen.findByRole('button', { name: 'Send email' });
    await waitFor(() => expect(sendButton).toBeEnabled());
    await user.click(sendButton);
    await waitFor(() => expect(apiPostVoid).toHaveBeenCalled());

    expect(await screen.findByRole('button', { name: 'Sending…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    resolveSend();
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'Invitation sent' }));
  });

  it('surfaces a destructive toast when the send fails', async () => {
    let rejectSend!: (reason: Error) => void;
    apiPostVoid.mockReturnValue(new Promise<void>((_resolve, reject) => { rejectSend = reject; }));
    renderSheet();
    const user = userEvent.setup({ pointerEventsCheck: 0 });

    const sendButton = await screen.findByRole('button', { name: 'Send email' });
    await waitFor(() => expect(sendButton).toBeEnabled());
    await user.click(sendButton);
    await waitFor(() => expect(apiPostVoid).toHaveBeenCalled());
    rejectSend(new Error('mail transport failed'));

    await waitFor(() => expect(toast).toHaveBeenCalledWith({
      title: 'Failed to send invitation. Please try again.',
      variant: 'destructive',
    }));
  });

  it('copies the rendered message and keeps Mark as sent as a separate logged action', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const previousClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    try {
      renderSheet();
      const copyButton = await screen.findByRole('button', { name: 'Copy message' });
      await waitFor(() => expect(copyButton).toBeEnabled());
      await user.click(copyButton);

      await waitFor(() => expect(writeText).toHaveBeenCalledWith('Invitation: https://app.gigloop.com/band/member-token'));
      const copiedToast = toast.mock.calls.find(([options]) => options.title === 'Invitation copied')?.[0];
      expect(copiedToast).toBeDefined();
      const markAsSent = copiedToast?.action as ReactElement<{ onClick: () => void }>;
      markAsSent.props.onClick();

      await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/bookings/booking-1/communications', {
        contactId: 'contact-1',
        subject: 'Band invitation message',
        body: 'Invitation: https://app.gigloop.com/band/member-token',
        templateId: inviteMessageTemplate.id,
        channel: 'MANUAL',
      }));
      expect(apiPatch).toHaveBeenCalledWith('/bookings/booking-1/band-members/member-1', { status: 'INVITED' });
      expect(apiPost.mock.invocationCallOrder[0]).toBeLessThan(apiPatch.mock.invocationCallOrder[0]);
    } finally {
      if (previousClipboard) Object.defineProperty(navigator, 'clipboard', previousClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('offers a selectable text fallback when clipboard access fails', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const previousClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('clipboard denied')) },
    });
    try {
      renderSheet();
      const copyButton = await screen.findByRole('button', { name: 'Copy message' });
      await waitFor(() => expect(copyButton).toBeEnabled());
      await user.click(copyButton);

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Select and copy this message manually:',
      );
      expect(screen.getByRole('textbox', { name: 'Invitation message to copy manually' })).toHaveValue(
        'Invitation: https://app.gigloop.com/band/member-token',
      );
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Could not copy the invitation. Select the message below and copy it manually.',
        variant: 'destructive',
      }));
    } finally {
      if (previousClipboard) Object.defineProperty(navigator, 'clipboard', previousClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });
});
