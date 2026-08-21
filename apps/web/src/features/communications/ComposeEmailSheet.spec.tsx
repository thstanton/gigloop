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
  primaryBandRole: null,
  instruments: [],
  travelNotes: null,
  equipmentNotes: null,
  outfitNotes: null,
  availabilityNotes: null,
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
  portalToken: 'tok-1',
  hasMusicFormConfig: false,
  hasMusicFormResponse: false,
  portalVisibility: { contract: null, musicForm: null },
  band: { chairs: [], members: [] },
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
        checklist={[]}
        defaultPaymentTermsDays={undefined}
        open={open}
        onOpenChange={setOpen}
        initialTemplateType="confirmation"
        onCreateContract={() => {}}
        creatingContract={false}
        createDepositInvoiceHref="/admin/bookings/b1?sheet=invoice&isDeposit=true"
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

// ─── Series mode (#847) ─────────────────────────────────────────────────────

const mockSeriesContact = { ...mockContact, id: 'c-series', name: 'Hotel Group', email: 'bookings@hotel.test' };

const mockSeriesInvoice = {
  id: 'ser-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  status: 'ISSUED',
  isDeposit: false,
  invoiceNumber: 'INV-0007',
  issueDate: '2026-01-01',
  dueDate: null,
  paidAt: null,
  paymentReference: null,
  bookingId: null,
  seriesId: 's1',
  billToContactId: 'c-series',
  billToContact: mockSeriesContact,
  lineItems: [],
} as unknown as Invoice;

const seriesTarget = {
  seriesId: 's1',
  seriesLabel: 'Thursday residency',
  invoice: mockSeriesInvoice,
  recipient: mockSeriesContact,
};

const mockSeriesCoverTemplate: Template = {
  id: 'tpl-series',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  name: 'Series invoice email',
  builtInType: 'series_invoice_cover',
  content: {},
};

function SeriesWrapper({ series }: { series?: typeof seriesTarget }) {
  const [open, setOpen] = useState(true);
  return (
    <QueryClientProvider client={makeClient()}>
      <ComposeEmailSheet
        bookingId="b1"
        booking={mockBooking}
        // The member booking's own invoice list — always empty for a series member, which is what
        // left the old booking-scoped resolution with nothing to attach.
        invoices={[] as Invoice[]}
        checklist={[]}
        defaultPaymentTermsDays={undefined}
        open={open}
        onOpenChange={setOpen}
        initialTemplateType="series_invoice_cover"
        onCreateContract={() => {}}
        creatingContract={false}
        createDepositInvoiceHref="/admin/bookings/b1?sheet=invoice&isDeposit=true"
        series={series}
      />
    </QueryClientProvider>
  );
}

describe('ComposeEmailSheet — series invoice cover', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { apiGet, apiPostVoid } = await import('@/lib/api');
    vi.mocked(apiGet).mockImplementation((path: string) => {
      // Both built-ins are returned: the picker must choose by owner, not by what is available.
      if (path === '/templates') return Promise.resolve([mockTemplate, mockSeriesCoverTemplate]);
      if (path.includes('/render'))
        return Promise.resolve({
          subject: 'Your invoice for Thursday residency',
          body: '<p>Dear Hotel Group,</p>',
          missingVariables: [],
        });
      return Promise.resolve([]);
    });
    vi.mocked(apiPostVoid).mockResolvedValue(undefined);
  });

  it('composes against the series: series recipient, stored PDF attached, series render + send routes', async () => {
    const user = userEvent.setup();
    const { apiGet, apiPostVoid } = await import('@/lib/api');

    render(<SeriesWrapper series={seriesTarget} />);

    // Addressed to the series customer — not the member booking's customer (Sarah Johnson).
    expect(await screen.findByText('Hotel Group')).toBeInTheDocument();
    expect(screen.queryByText('Sarah Johnson')).not.toBeInTheDocument();

    // The attachment is the series invoice's stored PDF, named from its number — resolved from
    // the target, never from the (empty) booking invoice list.
    expect(await screen.findByText('Invoice INV-0007.pdf')).toBeInTheDocument();

    // Rendered with series context, via the series route.
    await waitFor(() =>
      expect(vi.mocked(apiGet)).toHaveBeenCalledWith(
        '/series/s1/communications/render?templateId=tpl-series&invoiceId=ser-1',
      ),
    );
    expect(await screen.findByDisplayValue('Your invoice for Thursday residency')).toBeInTheDocument();

    const sendBtn = await screen.findByRole('button', { name: /^send$/i });
    await waitFor(() => expect(sendBtn).not.toBeDisabled(), { timeout: 3000 });
    await user.click(sendBtn);

    await waitFor(() =>
      expect(vi.mocked(apiPostVoid)).toHaveBeenCalledWith(
        '/series/s1/invoices/ser-1/send',
        expect.objectContaining({ to: 'bookings@hotel.test', contactId: 'c-series', templateId: 'tpl-series' }),
      ),
    );
  });

  // Why BookingDetailSheets holds the sheet shut until the series invoice resolves: the pre-select
  // fires once, and with no target the series cover is not in the list to select. Opening early
  // therefore burns the pre-select and leaves the musician staring at an unselected picker.
  it('selects nothing when opened for the series cover without a resolved target', async () => {
    render(<SeriesWrapper />);

    expect(await screen.findByText('Select a template')).toBeInTheDocument();
    expect(screen.queryByText('Invoice INV-0007.pdf')).not.toBeInTheDocument();
  });
});
