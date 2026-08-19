import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useInvoiceActions } from './useInvoiceActions';
import { apiPost, apiPatch } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import type { Invoice } from '@/types/api';

vi.mock('@/lib/api', () => ({
  apiPost: vi.fn().mockResolvedValue({}),
  apiPatch: vi.fn().mockResolvedValue({}),
  apiPostVoid: vi.fn().mockResolvedValue(undefined),
  apiDelete: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/hooks/use-toast', () => ({ toast: vi.fn() }));

function invoice(over: Partial<Invoice>): Invoice {
  return {
    id: 'i1', isDeposit: false, status: 'SENT', bookingId: 'b1', seriesId: null,
    paidAt: null, paymentReference: null,
    ...over,
  } as unknown as Invoice;
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useInvoiceActions(), { wrapper });
}

describe('useInvoiceActions — mark-paid dialog (ADR-0068)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requestMarkPaid opens the dialog with no prefill; confirming POSTs mark-paid with the chosen values', async () => {
    const { result } = setup();

    act(() => result.current.requestMarkPaid(invoice({ status: 'SENT' })));
    expect(result.current.markPaidDialog.open).toBe(true);
    // Record mode: defaults to today in the dialog, so no prefill is passed.
    expect(result.current.markPaidDialog.initialPaidAt).toBeUndefined();
    expect(apiPost).not.toHaveBeenCalled();

    act(() => result.current.markPaidDialog.onConfirm('2026-08-18', 'BACS-4417'));
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/bookings/b1/invoices/i1/mark-paid', {
        paidAt: '2026-08-18',
        paymentReference: 'BACS-4417',
      }),
    );
  });
});

describe('useInvoiceActions — correct payment dialog (TIM-46)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requestCorrectPayment opens the same dialog prefilled from the stored values; confirming PATCHes the payment', async () => {
    const { result } = setup();
    const paid = invoice({ status: 'PAID', paidAt: '2026-08-02T00:00:00Z', paymentReference: 'OLD-REF' });

    act(() => result.current.requestCorrectPayment(paid));
    expect(result.current.markPaidDialog.open).toBe(true);
    // Correct mode: prefilled from the stored date (ISO → date portion) and reference.
    expect(result.current.markPaidDialog.initialPaidAt).toBe('2026-08-02');
    expect(result.current.markPaidDialog.initialReference).toBe('OLD-REF');

    act(() => result.current.markPaidDialog.onConfirm('2026-08-05', 'NEW-REF'));
    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith('/bookings/b1/invoices/i1/payment', {
        paidAt: '2026-08-05',
        paymentReference: 'NEW-REF',
      }),
    );
    // A correction must never fall through to the mark-paid POST.
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('clearing the reference PATCHes with an omitted reference', async () => {
    const { result } = setup();
    const paid = invoice({ status: 'PAID', paidAt: '2026-08-02T00:00:00Z', paymentReference: 'OLD-REF' });

    act(() => result.current.requestCorrectPayment(paid));
    act(() => result.current.markPaidDialog.onConfirm('2026-08-02', ''));
    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith('/bookings/b1/invoices/i1/payment', {
        paidAt: '2026-08-02',
        paymentReference: undefined,
      }),
    );
  });

  it('routes a series invoice correction to the series endpoint', async () => {
    const { result } = setup();
    const paid = invoice({ id: 'si1', status: 'PAID', bookingId: null, seriesId: 's1', paidAt: '2026-08-02T00:00:00Z' });

    act(() => result.current.requestCorrectPayment(paid));
    act(() => result.current.markPaidDialog.onConfirm('2026-08-02', ''));
    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith('/series/s1/invoices/si1/payment', expect.objectContaining({ paidAt: '2026-08-02' })),
    );
  });
});

// #850: creating a series invoice surfaces a count of fee-less members so a £0.00 line never
// reaches a client unnoticed. The line is still created either way — this is a heads-up, not a block.
describe('useInvoiceActions — create series invoice fee-less warning (#850)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows no toast when every member has a fee', async () => {
    vi.mocked(apiPost).mockResolvedValue({ invoice: { id: 'inv1' }, feelessMemberCount: 0 });
    const { result } = setup();

    act(() => result.current.createSeriesInvoice('s1'));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/series/s1/invoices', {}));
    expect(toast).not.toHaveBeenCalled();
  });

  it('warns with singular copy when exactly one member has no fee', async () => {
    vi.mocked(apiPost).mockResolvedValue({ invoice: { id: 'inv1' }, feelessMemberCount: 1 });
    const { result } = setup();

    act(() => result.current.createSeriesInvoice('s1'));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({
        title: '1 member billed with no fee set',
        description: expect.stringContaining('The line shows £0.00'),
      })),
    );
  });

  it('warns with plural copy when several members have no fee', async () => {
    vi.mocked(apiPost).mockResolvedValue({ invoice: { id: 'inv1' }, feelessMemberCount: 3 });
    const { result } = setup();

    act(() => result.current.createSeriesInvoice('s1'));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({
        title: '3 members billed with no fee set',
        description: expect.stringContaining('The lines show £0.00'),
      })),
    );
  });
});
