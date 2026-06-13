import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ComposeEmailSheet from './ComposeEmailSheet';
import type { BookingDetail, Invoice, Template } from '@/types/api';

vi.mock('@clerk/react', () => ({
  useAuth: () => ({ isLoaded: true }),
}));

vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn(() => ({
    commands: { setContent: vi.fn() },
    getHTML: vi.fn(() => '<p>Hello</p>'),
    destroy: vi.fn(),
    isDestroyed: false,
  })),
  EditorContent: () => null,
}));

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
  apiPostVoid: vi.fn(),
}));

const mockContact = {
  id: 'c1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  name: 'Sarah Johnson',
  greetingName: null,
  email: 'sarah@example.com',
  phone: null,
  notes: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  county: null,
  postcode: null,
  country: null,
  latitude: null,
  longitude: null,
  placeId: null,
  travelTimeMinutes: null,
  travelDistanceMetres: null,
  travelTimeCalculatedAt: null,
  travelMode: null,
  parkingInfo: null,
  accessInfo: null,
  equipmentAvailable: null,
  website: null,
  commissionArrangement: null,
  primaryRole: null,
};

const mockBooking: BookingDetail = {
  id: 'b1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  status: 'CONFIRMED',
  eventType: 'WEDDING',
  date: '2026-08-15T18:00:00Z',
  title: 'Summer Wedding',
  fee: '2500',
  notes: null,
  customerId: 'c1',
  customer: mockContact,
  venueId: null,
  venue: null,
  bookingAgentId: null,
  bookingAgent: null,
  sets: [],
  series: null,
  seriesId: null,
  packages: [],
  depositReceivedAt: null,
  portalToken: 'tok-1',
  hasMusicFormConfig: false,
  hasMusicFormResponse: false,
  logistics: null,
  activeContract: null,
};

const mockTemplate: Template = {
  id: 'tpl-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  name: 'Confirmation',
  builtInType: 'confirmation',
  content: {},
};

const mockRenderResult = {
  subject: 'Booking Confirmation - Summer Wedding',
  body: '<p>Dear Sarah,</p>',
  missingVariables: [],
};

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function Wrapper() {
  const [open, setOpen] = useState(true);
  return (
    <QueryClientProvider client={makeClient()}>
      <ComposeEmailSheet
        bookingId="b1"
        booking={mockBooking}
        invoices={[] as Invoice[]}
        defaultPaymentTermsDays={undefined}
        open={open}
        onOpenChange={setOpen}
        initialTemplateType="confirmation"
      />
    </QueryClientProvider>
  );
}

describe('ComposeEmailSheet — mutation error recovery', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { apiGet, apiPostVoid } = await import('@/lib/api');
    vi.mocked(apiGet).mockImplementation((path: string) => {
      if (path === '/templates') return Promise.resolve([mockTemplate]);
      if (path.includes('/render')) return Promise.resolve(mockRenderResult);
      return Promise.resolve([]);
    });
    vi.mocked(apiPostVoid).mockResolvedValue(undefined);
  });

  it('shows error and re-enables Send after failure, closes sheet on successful retry', async () => {
    const user = userEvent.setup();
    const { apiPostVoid } = await import('@/lib/api');

    vi.mocked(apiPostVoid)
      .mockRejectedValueOnce(new Response('Internal Server Error', { status: 500 }))
      .mockResolvedValueOnce(undefined);

    render(<Wrapper />);

    const sendBtn = await screen.findByRole('button', { name: /^send$/i });
    await waitFor(() => expect(sendBtn).not.toBeDisabled(), { timeout: 3000 });

    await user.click(sendBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/failed to send email/i),
      ).toBeInTheDocument();
    });
    expect(sendBtn).not.toBeDisabled();

    await user.click(sendBtn);

    await waitFor(() => {
      expect(screen.queryByText(/failed to send email/i)).not.toBeInTheDocument();
    });
  });
});
