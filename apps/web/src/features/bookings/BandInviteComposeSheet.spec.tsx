import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BandInviteComposeSheet } from './BandInviteComposeSheet';
import type { BookingBandMember } from '@/types/api';

const { apiGet, apiPostVoid, toast } = vi.hoisted(() => ({
  apiGet: vi.fn(),
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

vi.mock('@/lib/api', () => ({ apiGet, apiPostVoid }));
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
    apiPostVoid.mockClear();
    toast.mockClear();
    apiGet.mockImplementation(async (url: string) => {
      if (url === '/templates') return [inviteTemplate];
      if (url.includes('/invite/render')) {
        return { subject: 'You’re invited — 2026-09-15', body: '<p>Invitation body</p>', missingVariables: [] };
      }
      throw new Error(`Unexpected GET ${url}`);
    });
    apiPostVoid.mockResolvedValue(undefined);
  });

  it('shows a visible reason and disables email send when the member has no email', async () => {
    renderSheet({ ...member, contact: { ...member.contact, email: null } });

    expect(await screen.findByText('No email address on file for Dave Jones. Add one before sending.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Send invitation' })).toBeDisabled();
  });

  it('disables the send action and labels it Sending while the request is pending', async () => {
    let resolveSend!: () => void;
    apiPostVoid.mockReturnValue(new Promise<void>((resolve) => { resolveSend = resolve; }));
    renderSheet();
    const user = userEvent.setup({ pointerEventsCheck: 0 });

    const sendButton = await screen.findByRole('button', { name: 'Send invitation' });
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

    const sendButton = await screen.findByRole('button', { name: 'Send invitation' });
    await waitFor(() => expect(sendButton).toBeEnabled());
    await user.click(sendButton);
    await waitFor(() => expect(apiPostVoid).toHaveBeenCalled());
    rejectSend(new Error('mail transport failed'));

    await waitFor(() => expect(toast).toHaveBeenCalledWith({
      title: 'Failed to send invitation. Please try again.',
      variant: 'destructive',
    }));
  });
});
