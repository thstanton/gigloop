import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useChecklistActions } from './useChecklistActions';
import { apiGet, apiPost } from '@/lib/api';
import type { Invoice } from '@/types/api';

const setSearchParams = vi.fn();

vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useSearchParams: () => [new URLSearchParams(), setSearchParams] as const,
}));
vi.mock('@/lib/api', () => ({
  apiGet: vi.fn().mockResolvedValue(undefined),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));
const toast = vi.fn();
vi.mock('@/lib/hooks/use-toast', () => ({ toast: (...a: unknown[]) => toast(...a) }));

// Controllable Clerk auth state so a test can assert queries stay gated until Clerk initialises.
const authState = { isLoaded: true, isSignedIn: true };
vi.mock('@clerk/react', () => ({ useAuth: () => authState }));

// A booking invoice for booking 'b1' — the owner FK (bookingId) drives the endpoint the
// unified useInvoiceActions derives (#724), so it must be present as it is on a real invoice.
function invoice(over: Partial<Invoice>): Invoice {
  return { id: 'i1', isDeposit: false, status: 'DRAFT', bookingId: 'b1', seriesId: null, ...over } as unknown as Invoice;
}

function setup(invoices: Invoice[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['booking', 'b1'], { id: 'b1', fee: '1000', status: 'CONFIRMED' });
  client.setQueryData(['bookingInvoices', 'b1'], invoices);
  client.setQueryData(['me'], { depositPercentage: 50 });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useChecklistActions('b1'), { wrapper });
  return { result, client };
}

describe('useChecklistActions — query gating (#593)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.isLoaded = true;
    authState.isSignedIn = true;
  });

  it('does not fire any query before Clerk has initialised', () => {
    authState.isLoaded = false;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    renderHook(() => useChecklistActions('b1'), { wrapper });
    expect(apiGet).not.toHaveBeenCalled();
  });
});

describe('useChecklistActions — draft-aware invoice shortcut (ADR-0056)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.isLoaded = true;
    authState.isSignedIn = true;
  });

  it('opens the existing DRAFT in the edit sheet (does not create a second invoice)', () => {
    const { result } = setup([invoice({ id: 'd1', isDeposit: true, status: 'DRAFT' })]);

    act(() => result.current.handleChecklistAction('create_deposit_invoice'));

    expect(setSearchParams).toHaveBeenCalledWith({ sheet: 'invoice', invoiceId: 'd1' });
    expect(toast).not.toHaveBeenCalled();
  });

  it('opens the Create sheet prefilled with the computed amount when no invoice exists', () => {
    const { result } = setup([]);

    act(() => result.current.handleChecklistAction('create_deposit_invoice'));

    // fee 1000 × 50% = 500 deposit, passed as a prefill (nothing persisted yet).
    expect(setSearchParams).toHaveBeenCalledWith(
      expect.objectContaining({ sheet: 'invoice', isDeposit: 'true', amount: '500' }),
    );
    expect(toast).not.toHaveBeenCalled();
  });

  it('warns to void first when an already-issued invoice exists', () => {
    const { result } = setup([invoice({ id: 's1', isDeposit: true, status: 'SENT' })]);

    act(() => result.current.handleChecklistAction('create_deposit_invoice'));

    expect(setSearchParams).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' }),
    );
  });
});

describe('useChecklistActions — handleMarkDone opens the mark-paid dialog (#653, ADR-0068)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.isLoaded = true;
    authState.isSignedIn = true;
    (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  it('mark_balance_received opens the dialog for the SENT balance invoice (not the draft); confirming records the chosen date + reference', async () => {
    const { result } = setup([
      invoice({ id: 'sb1', isDeposit: false, status: 'SENT' }),
      invoice({ id: 'db1', isDeposit: false, status: 'DRAFT' }),
    ]);

    // Opens the dialog — no POST yet (the tap no longer silently stamps "now").
    act(() => result.current.handleMarkDone('mark_balance_received'));
    expect(result.current.markPaidDialog.open).toBe(true);
    expect(apiPost).not.toHaveBeenCalled();

    // Confirming with a chosen date + reference records them against the SENT balance invoice.
    act(() => result.current.markPaidDialog.onConfirm('2026-08-18', 'BACS-4417'));
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/invoices/sb1/mark-paid', {
        paidAt: '2026-08-18',
        paymentReference: 'BACS-4417',
      }),
    );
  });

  it('mark_deposit_received opens the dialog for the SENT deposit invoice; a blank reference is omitted', async () => {
    const { result } = setup([invoice({ id: 'sd1', isDeposit: true, status: 'SENT' })]);

    act(() => result.current.handleMarkDone('mark_deposit_received'));
    expect(result.current.markPaidDialog.open).toBe(true);

    act(() => result.current.markPaidDialog.onConfirm('2026-08-18', ''));
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/invoices/sd1/mark-paid', {
        paidAt: '2026-08-18',
        paymentReference: undefined,
      }),
    );
  });
});

describe('useChecklistActions — play solo (#902)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.isLoaded = true;
    authState.isSignedIn = true;
  });

  it('posts once and invalidates this checklist plus the user defaults', async () => {
    (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    const { result, client } = setup([]);
    const invalidateQueries = vi.spyOn(client, 'invalidateQueries');

    act(() => result.current.soloExitAction.onClick());

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/bookings/b1/checklist/solo', {}));
    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['bookingChecklist', 'b1'] });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['me'] });
    });
  });

  it('reports a destructive toast when the action fails', async () => {
    (apiPost as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('request failed'));
    const { result } = setup([]);

    act(() => result.current.soloExitAction.onClick());

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        title: 'Could not update the band checklist',
        variant: 'destructive',
      }),
    );
  });

  it('exposes pending state while the action request is in flight', async () => {
    let resolveRequest: ((value: { success: boolean }) => void) | undefined;
    (apiPost as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((resolve) => { resolveRequest = resolve; }),
    );
    const { result } = setup([]);

    act(() => result.current.soloExitAction.onClick());

    await waitFor(() => expect(result.current.soloExitAction.isPending).toBe(true));
    await act(async () => {
      resolveRequest?.({ success: true });
    });
    await waitFor(() => expect(result.current.soloExitAction.isPending).toBe(false));
  });
});
