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
  return { result };
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

describe('useChecklistActions — handleMarkDone marks the invoice paid (#653)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.isLoaded = true;
    authState.isSignedIn = true;
    (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  it('mark_balance_received marks the SENT balance invoice paid (not the draft)', async () => {
    const { result } = setup([
      invoice({ id: 'sb1', isDeposit: false, status: 'SENT' }),
      invoice({ id: 'db1', isDeposit: false, status: 'DRAFT' }),
    ]);

    act(() => result.current.handleMarkDone('mark_balance_received'));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/bookings/b1/invoices/sb1/mark-paid', {}),
    );
  });

  it('mark_deposit_received marks the SENT deposit invoice paid', async () => {
    const { result } = setup([invoice({ id: 'sd1', isDeposit: true, status: 'SENT' })]);

    act(() => result.current.handleMarkDone('mark_deposit_received'));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/bookings/b1/invoices/sd1/mark-paid', {}),
    );
  });
});
