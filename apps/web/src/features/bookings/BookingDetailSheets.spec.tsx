import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BookingDetailSheets } from './BookingDetailSheets';
import { apiGet } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import type { Invoice } from '@/types/api';

// #844 — container-level regression guard for ADR-0069.
//
// The bug this pins was invisible to `SeriesInvoiceSection.spec.tsx`, and necessarily so:
// that spec feeds the *presentational* component its props, while the defect lived entirely
// in how the host resolved those props. `BookingDetailSheets` looked the acted-on invoice up
// with `invoices.find(...)` over `useBookingInvoices(bookingId)` — a list that by
// construction can never hold a series invoice, since one has `bookingId: null`. The lookup
// yielded `undefined`, `InvoiceSheet` read that as "no invoice" and opened in *create* mode,
// and the musician saw an empty form instead of an error. So these tests exercise the
// container, and assert on what the sheet actually renders.
//
// Note on the assertions: `InvoiceSheet` seeds its fields with react-hook-form's `reset()`,
// which assigns the input `value` *property*. That produces no DOM mutation record, so
// `findByDisplayValue`'s MutationObserver never re-queries and the value is missed. Hence
// `waitFor` (which also polls on an interval) for anything value-shaped; `findBy*` is fine
// for the headings, which are real node insertions.

vi.mock('@clerk/react', () => ({
  useAuth: () => ({ isLoaded: true }),
}));

vi.mock('@/lib/hooks/use-toast', () => ({
  toast: vi.fn(),
  useToast: () => ({ toast: vi.fn(), dismiss: vi.fn(), toasts: [] }),
}));

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
  apiGetNullable: vi.fn().mockResolvedValue(null),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiPut: vi.fn(),
  apiPostVoid: vi.fn(),
  apiDelete: vi.fn(),
  apiGetBlob: vi.fn(),
  apiPostFormData: vi.fn(),
  openGeneratedPdf: vi.fn(),
  openDocument: vi.fn(),
}));

const BOOKING_ID = 'b1';

const seriesInvoice = {
  id: 'si1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  status: 'DRAFT',
  isDeposit: false,
  invoiceNumber: null,
  issueDate: null,
  dueDate: null,
  paidAt: null,
  paymentReference: null,
  // The pair that matters: no booking owns it, so no booking-scoped list can reach it.
  bookingId: null,
  seriesId: 'ser1',
  billToContactId: 'c1',
  lineItems: [
    { id: 'li1', description: 'May residency — week 1', amount: '1500.00', order: 0, sourceBookingId: 'b1' },
    { id: 'li2', description: 'May residency — week 2', amount: '1650.00', order: 1, sourceBookingId: 'b2' },
  ],
} as unknown as Invoice;

const bookingInvoice = {
  ...seriesInvoice,
  id: 'bi1',
  bookingId: BOOKING_ID,
  seriesId: null,
  lineItems: [{ id: 'li9', description: 'Wedding reception set', amount: '900.00', order: 0, sourceBookingId: null }],
} as unknown as Invoice;

const booking = {
  id: BOOKING_ID,
  status: 'CONFIRMED',
  title: 'Hotel X residency',
  date: '2030-04-01T19:00:00Z',
  eventType: 'CORPORATE',
  fee: '1500.00',
  customer: { id: 'c1', name: 'Sarah Johnson' },
  venue: null,
  bookingAgent: null,
  sets: [],
  packages: [],
  logistics: null,
  seriesId: 'ser1',
  hasMusicFormConfig: false,
  activeContract: null,
};

// Routes the container's reads by path, so the test exercises the real wiring rather than a
// stubbed hook. `/invoices/:id` is the route ADR-0069 adds and #844 depends on.
function stubApi(invoiceById: Record<string, Invoice>, bookingList: Invoice[] = []) {
  vi.mocked(apiGet).mockImplementation((path: string) => {
    if (path.startsWith('/invoices/')) {
      const found = invoiceById[path.replace('/invoices/', '')];
      return found ? Promise.resolve(found as never) : Promise.reject(new Error('404'));
    }
    if (path === `/bookings/${BOOKING_ID}/invoices`) return Promise.resolve(bookingList as never);
    if (path === `/bookings/${BOOKING_ID}`) return Promise.resolve(booking as never);
    if (path === `/bookings/${BOOKING_ID}/checklist`) return Promise.resolve([] as never);
    if (path === '/me') return Promise.resolve({ depositPercentage: null } as never);
    if (path === '/templates') return Promise.resolve([] as never);
    return Promise.resolve([] as never);
  });
}

function renderSheets(search: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/admin/bookings/${BOOKING_ID}${search}`]}>
        <BookingDetailSheets bookingId={BOOKING_ID} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BookingDetailSheets — resolving the acted-on invoice (#844)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens Edit on a series invoice with its real line items, not an empty create form', async () => {
    stubApi({ si1: seriesInvoice });
    renderSheets('?sheet=invoice&invoiceId=si1');

    // The heading is the tell that separates the two modes: the old wiring said "New Invoice".
    expect(await screen.findByRole('heading', { name: 'Edit Invoice' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByDisplayValue('May residency — week 1')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('May residency — week 2')).toBeInTheDocument();
    // Amounts are normalised for the form (`parseFloat(...).toString()`), hence 1500 not 1500.00.
    expect(screen.getByDisplayValue('1500')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1650')).toBeInTheDocument();
  });

  it('resolves the series invoice by id, never by searching the booking-scoped list', async () => {
    // The booking's list is deliberately non-empty and deliberately does not contain si1 —
    // exactly the production shape. A search-based resolution finds nothing here; only the
    // id-keyed read succeeds.
    stubApi({ si1: seriesInvoice }, [bookingInvoice]);
    renderSheets('?sheet=invoice&invoiceId=si1');

    await screen.findByRole('heading', { name: 'Edit Invoice' });
    expect(vi.mocked(apiGet)).toHaveBeenCalledWith('/invoices/si1');
  });

  it('keeps the sheet shut until the invoice resolves, so the form is never seeded empty', async () => {
    let release: (v: unknown) => void = () => {};
    const pending = new Promise((resolve) => { release = resolve; });
    vi.mocked(apiGet).mockImplementation((path: string) => {
      if (path === '/invoices/si1') return pending as never;
      if (path === `/bookings/${BOOKING_ID}`) return Promise.resolve(booking as never);
      return Promise.resolve([] as never);
    });

    renderSheets('?sheet=invoice&invoiceId=si1');

    // InvoiceSheet seeds its form on the open transition only. Opening before the invoice
    // lands would show a create-mode form that never corrects itself once it arrives.
    await waitFor(() => expect(vi.mocked(apiGet)).toHaveBeenCalledWith('/invoices/si1'));
    expect(screen.queryByRole('heading', { name: 'Edit Invoice' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'New Invoice' })).not.toBeInTheDocument();

    release(seriesInvoice);
    expect(await screen.findByRole('heading', { name: 'Edit Invoice' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByDisplayValue('May residency — week 1')).toBeInTheDocument();
    });
  });

  it('still opens Edit on a booking invoice unchanged', async () => {
    stubApi({ bi1: bookingInvoice }, [bookingInvoice]);
    renderSheets('?sheet=invoice&invoiceId=bi1');

    expect(await screen.findByRole('heading', { name: 'Edit Invoice' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByDisplayValue('Wedding reception set')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('900')).toBeInTheDocument();
  });

  it('opens the create form immediately when no invoice id is given', async () => {
    stubApi({});
    renderSheets('?sheet=invoice&isDeposit=true&amount=450&description=Deposit');

    expect(await screen.findByRole('heading', { name: 'New Invoice' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByDisplayValue('Deposit')).toBeInTheDocument();
    });
    // No id to resolve, so the by-id route is never asked. Checked against the actual call
    // list rather than a `stringContaining` matcher, which `/bookings/b1/invoices` confuses.
    const paths = vi.mocked(apiGet).mock.calls.map(([path]) => path);
    expect(paths.filter((path) => path.startsWith('/invoices/'))).toEqual([]);
  });
});

// #847 — the compose URL is a real address: bookmarkable, refreshable, and still reachable after
// the series invoice it names has been voided. The sheet is held shut until its target resolves
// (the pre-select fires once and cannot be re-run), so the failure mode is the sheet sitting
// silently closed — the musician navigates and nothing whatsoever happens. CLAUDE.md → Loading &
// Feedback: failure must always surface.
describe('BookingDetailSheets — series compose with no invoice to send (#847)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('surfaces a toast instead of leaving the compose sheet silently shut', async () => {
    const { apiGetNullable } = await import('@/lib/api');
    // A series member whose series has no active invoice — `current` 404s, which apiGetNullable
    // resolves to null rather than throwing.
    vi.mocked(apiGetNullable).mockResolvedValue(null);
    vi.mocked(apiGet).mockImplementation((path: string) => {
      if (path === `/bookings/${BOOKING_ID}`)
        return Promise.resolve({ ...booking, series: { id: 'ser1', label: 'Hotel X residency' } } as never);
      if (path === '/me') return Promise.resolve({ depositPercentage: null } as never);
      return Promise.resolve([] as never);
    });

    renderSheets('?sheet=compose&templateType=series_invoice_cover');

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'No series invoice to send', variant: 'destructive' }),
      ),
    );
    // And it stays shut rather than opening onto a picker with nothing in it.
    expect(screen.queryByRole('heading', { name: 'Compose email' })).not.toBeInTheDocument();
  });

  it('says nothing when the same page is opened without asking for the series cover', async () => {
    stubApi({});
    renderSheets('');

    await waitFor(() => expect(vi.mocked(apiGet)).toHaveBeenCalledWith(`/bookings/${BOOKING_ID}`));
    expect(toast).not.toHaveBeenCalled();
  });
});
