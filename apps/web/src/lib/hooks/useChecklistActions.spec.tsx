import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useChecklistActions } from './useChecklistActions';
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

function invoice(over: Partial<Invoice>): Invoice {
  return { id: 'i1', isDeposit: false, status: 'DRAFT', ...over } as unknown as Invoice;
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

describe('useChecklistActions — draft-aware invoice shortcut (ADR-0056)', () => {
  beforeEach(() => vi.clearAllMocks());

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
