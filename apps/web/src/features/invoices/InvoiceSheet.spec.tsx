import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import InvoiceSheet from './InvoiceSheet';
import { apiPost, apiPatch, apiDelete } from '@/lib/api';
import type { Invoice } from '@/types/api';

// #845 — the write half of ADR-0069.
//
// `persistLineItemEdits` addressed `/bookings/${bookingId}/invoices/...` for every create,
// update and delete. A series invoice has no owning booking, so each of those calls named a
// resource that cannot exist and no line item on a series invoice had ever been editable —
// which is also why ADR-0043's "reconciliation preserves manual edits and custom lines"
// guarantee had never had anything to preserve.
//
// These assert the *routes* the sheet writes to, because that is precisely what was wrong.

vi.mock('@clerk/react', () => ({
  useAuth: () => ({ isLoaded: true }),
}));

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn().mockResolvedValue({ invoiceNumber: 'INV-2026-001', willReuse: false }),
  apiPost: vi.fn().mockResolvedValue({ id: 'si1' }),
  apiPatch: vi.fn().mockResolvedValue({}),
  apiDelete: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/hooks/use-toast', () => ({ toast: vi.fn() }));

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'si1',
    status: 'DRAFT',
    isDeposit: false,
    invoiceNumber: null,
    issueDate: null,
    dueDate: null,
    paidAt: null,
    // A series invoice: owned by a series, owned by no booking.
    bookingId: null,
    seriesId: 'ser1',
    lineItems: [
      { id: 'li1', description: 'May 1 — Hotel X', amount: '500.00', order: 0, sourceBookingId: 'b1' },
      { id: 'li2', description: 'May 8 — Hotel X', amount: '500.00', order: 1, sourceBookingId: 'b2' },
    ],
    ...overrides,
  } as unknown as Invoice;
}

function renderSheet(inv: Invoice) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <InvoiceSheet
        // Deliberately supplied, and deliberately irrelevant: a series invoice is reached from a
        // member booking's page, so the host passes a bookingId. No edit write may consult it.
        bookingId="b1"
        invoice={inv}
        hasDepositInvoice={false}
        open
        onOpenChange={() => {}}
      />
    </QueryClientProvider>,
  );
}

const descriptionFields = () => screen.getAllByPlaceholderText('Description');
const amountFields = () => screen.getAllByPlaceholderText('0.00');

async function save() {
  await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
}

describe('InvoiceSheet — editing a series invoice (#845)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiPost).mockResolvedValue({ id: 'new-line' });
    vi.mocked(apiPatch).mockResolvedValue({});
    vi.mocked(apiDelete).mockResolvedValue(undefined);
  });

  it('seeds the form from the series invoice it was handed', async () => {
    renderSheet(invoice());
    await waitFor(() => {
      expect(descriptionFields()[0]).toHaveValue('May 1 — Hotel X');
    });
    expect(descriptionFields()[1]).toHaveValue('May 8 — Hotel X');
  });

  it('persists an edited description to the owner-agnostic route', async () => {
    renderSheet(invoice());
    await waitFor(() => expect(descriptionFields()[0]).toHaveValue('May 1 — Hotel X'));

    await userEvent.clear(descriptionFields()[0]);
    await userEvent.type(descriptionFields()[0], 'May 1 — Hotel X (matinee)');
    await save();

    await waitFor(() => {
      expect(vi.mocked(apiPatch)).toHaveBeenCalledWith(
        '/invoices/si1/line-items/li1',
        expect.objectContaining({ description: 'May 1 — Hotel X (matinee)' }),
      );
    });
    // The booking-scoped path is the bug; it must not appear at all.
    expect(vi.mocked(apiPatch)).not.toHaveBeenCalledWith(
      expect.stringContaining('/bookings/'),
      expect.anything(),
    );
  });

  it('persists an edited amount', async () => {
    renderSheet(invoice());
    await waitFor(() => expect(amountFields()[1]).toHaveValue('500'));

    await userEvent.clear(amountFields()[1]);
    await userEvent.type(amountFields()[1], '750');
    await save();

    await waitFor(() => {
      expect(vi.mocked(apiPatch)).toHaveBeenCalledWith(
        '/invoices/si1/line-items/li2',
        expect.objectContaining({ amount: 750 }),
      );
    });
  });

  // The line ADR-0043 exists to protect: no `sourceBookingId`, so reconciliation leaves it alone.
  it('adds a hand-written custom line', async () => {
    renderSheet(invoice());
    await waitFor(() => expect(descriptionFields()).toHaveLength(2));

    await userEvent.click(screen.getByRole('button', { name: /add line item/i }));
    await userEvent.type(descriptionFields()[2], 'PA hire');
    await userEvent.type(amountFields()[2], '200');
    await save();

    await waitFor(() => {
      expect(vi.mocked(apiPost)).toHaveBeenCalledWith(
        '/invoices/si1/line-items',
        expect.objectContaining({ description: 'PA hire', amount: 200 }),
      );
    });
  });

  it('deletes a removed line', async () => {
    renderSheet(invoice());
    await waitFor(() => expect(descriptionFields()).toHaveLength(2));

    await userEvent.click(screen.getAllByRole('button', { name: 'Remove line item' })[0]);
    await save();

    await waitFor(() => {
      expect(vi.mocked(apiDelete)).toHaveBeenCalledWith('/invoices/si1/line-items/li1');
    });
    expect(vi.mocked(apiDelete)).not.toHaveBeenCalledWith('/invoices/si1/line-items/li2');
  });

  it('sends the new order when a line is appended after an existing one', async () => {
    renderSheet(invoice());
    await waitFor(() => expect(descriptionFields()).toHaveLength(2));

    await userEvent.click(screen.getByRole('button', { name: /add line item/i }));
    await userEvent.type(descriptionFields()[2], 'Travel');
    await userEvent.type(amountFields()[2], '80');
    await save();

    await waitFor(() => {
      expect(vi.mocked(apiPost)).toHaveBeenCalledWith(
        '/invoices/si1/line-items',
        expect.objectContaining({ order: 2 }),
      );
    });
  });

  // #918 — `indexOf(item) + idx` double-counted position, so two lines appended at form
  // positions 2 and 3 got order 2 and 4 instead of 2 and 3.
  it('sends contiguous order values when two lines are appended in the same save', async () => {
    renderSheet(invoice());
    await waitFor(() => expect(descriptionFields()).toHaveLength(2));

    await userEvent.click(screen.getByRole('button', { name: /add line item/i }));
    await userEvent.type(descriptionFields()[2], 'Travel');
    await userEvent.type(amountFields()[2], '80');
    await userEvent.click(screen.getByRole('button', { name: /add line item/i }));
    await userEvent.type(descriptionFields()[3], 'PA hire');
    await userEvent.type(amountFields()[3], '200');
    await save();

    await waitFor(() => {
      expect(vi.mocked(apiPost)).toHaveBeenCalledWith(
        '/invoices/si1/line-items',
        expect.objectContaining({ description: 'Travel', order: 2 }),
      );
    });
    expect(vi.mocked(apiPost)).toHaveBeenCalledWith(
      '/invoices/si1/line-items',
      expect.objectContaining({ description: 'PA hire', order: 3 }),
    );
  });

  it('edits an amount AND appends a custom line in the same save', async () => {
    renderSheet(invoice());
    await waitFor(() => expect(amountFields()[0]).toHaveValue('500'));

    await userEvent.clear(amountFields()[0]);
    await userEvent.type(amountFields()[0], '750');
    await userEvent.click(screen.getByRole('button', { name: /add line item/i }));
    await userEvent.type(descriptionFields()[2], 'PA hire');
    await userEvent.type(amountFields()[2], '200');
    await save();

    await waitFor(() => {
      expect(vi.mocked(apiPost)).toHaveBeenCalledWith(
        '/invoices/si1/line-items',
        expect.objectContaining({ description: 'PA hire', amount: 200 }),
      );
    });
    expect(vi.mocked(apiPatch)).toHaveBeenCalledWith(
      '/invoices/si1/line-items/li1',
      expect.objectContaining({ amount: 750 }),
    );
  });

  // #855: BookingDetailSheets computes `open` as
  // `sheet === 'invoice' && (!sheetInvoiceId || !!editingInvoice)` — held false while the edit
  // target (`useInvoice`, gcTime: 0) hasn't resolved. That can transiently flip `open` false→true
  // again for the *same* invoice — e.g. a background refetch briefly clearing `data` — without
  // InvoiceSheet itself ever closing. The old effect reset the form on every such flip, silently
  // discarding whatever the user had already typed. This reproduces that flip directly and proves
  // the in-progress edit survives it.
  it('preserves an in-progress edit through a spurious re-open of the same invoice', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const inv = invoice();
    const props = {
      bookingId: 'b1',
      invoice: inv,
      hasDepositInvoice: false,
      onOpenChange: () => {},
    };

    const { rerender } = render(
      <QueryClientProvider client={client}>
        <InvoiceSheet {...props} open />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(amountFields()[0]).toHaveValue('500'));

    await userEvent.clear(amountFields()[0]);
    await userEvent.type(amountFields()[0], '750');

    // The parent transiently holds the sheet shut while re-resolving the same edit target, then
    // reopens it — InvoiceSheet never called onOpenChange itself, so this is not a real close.
    rerender(
      <QueryClientProvider client={client}>
        <InvoiceSheet {...props} open={false} />
      </QueryClientProvider>,
    );
    rerender(
      <QueryClientProvider client={client}>
        <InvoiceSheet {...props} open />
      </QueryClientProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: /add line item/i }));
    await userEvent.type(descriptionFields()[2], 'PA hire');
    await userEvent.type(amountFields()[2], '200');
    await save();

    await waitFor(() => {
      expect(vi.mocked(apiPatch)).toHaveBeenCalledWith(
        '/invoices/si1/line-items/li1',
        expect.objectContaining({ amount: 750 }),
      );
    });
  });

  // #929 diagnostic (unit-level, not the flake itself — this asserts what the code guarantees so
  // the mechanism can be ruled in/out deterministically): a background refetch of `['invoice', id]`
  // (e.g. from the checklist mutation's invalidation landing mid-edit) updates the `invoice` prop
  // to a *new object reference* without the parent ever flipping `open`. The reset effect's
  // dependency array is `[open]` only, so this must not re-seed the form. If this test starts
  // failing, the effect's dependencies changed and the #929 mechanism is back in play.
  it('preserves an in-progress edit through an invoice prop refresh while open never changes', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const inv = invoice();
    const props = {
      bookingId: 'b1',
      hasDepositInvoice: false,
      onOpenChange: () => {},
      open: true,
    };

    const { rerender } = render(
      <QueryClientProvider client={client}>
        <InvoiceSheet {...props} invoice={inv} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(amountFields()[0]).toHaveValue('500'));

    await userEvent.clear(amountFields()[0]);
    await userEvent.type(amountFields()[0], '750');

    // A new `invoice` object, same underlying data — exactly what a background refetch that found
    // nothing changed server-side would hand back. `open` is never touched.
    rerender(
      <QueryClientProvider client={client}>
        <InvoiceSheet {...props} invoice={invoice()} />
      </QueryClientProvider>,
    );

    expect(amountFields()[0]).toHaveValue('750');

    await save();

    await waitFor(() => {
      expect(vi.mocked(apiPatch)).toHaveBeenCalledWith(
        '/invoices/si1/line-items/li1',
        expect.objectContaining({ amount: 750 }),
      );
    });
  });

  // Issue is owner-agnostic (#853, ADR-0069) — it addresses the invoice by its own id, not the
  // bookingId prop the sheet happens to be mounted with, so this reaches a series invoice fine.
  it('issues by the invoice id, not the bookingId prop', async () => {
    renderSheet(invoice());
    await waitFor(() => expect(descriptionFields()).toHaveLength(2));

    await userEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Issue invoice', hidden: false }));

    await waitFor(() => {
      expect(vi.mocked(apiPost)).toHaveBeenCalledWith('/invoices/si1/issue', {});
    });
  });
});

describe('InvoiceSheet — editing a booking invoice is unchanged in behaviour (#845)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiPatch).mockResolvedValue({});
  });

  // The routes move for booking invoices too — that is the point of owner-agnostic, and the
  // server keeps the old ones for now — but the user-visible behaviour must not change.
  it('writes a booking invoice edit to the same owner-agnostic route', async () => {
    renderSheet(invoice({ id: 'bi1', bookingId: 'b1', seriesId: null } as Partial<Invoice>));
    await waitFor(() => expect(descriptionFields()[0]).toHaveValue('May 1 — Hotel X'));

    await userEvent.clear(amountFields()[0]);
    await userEvent.type(amountFields()[0], '650');
    await save();

    await waitFor(() => {
      expect(vi.mocked(apiPatch)).toHaveBeenCalledWith(
        '/invoices/bi1/line-items/li1',
        expect.objectContaining({ amount: 650 }),
      );
    });
  });
});
