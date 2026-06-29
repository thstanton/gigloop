import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useBookingActions } from '@/lib/hooks/useBookingActions';
import { useContractActions } from '@/lib/hooks/useContractActions';
import { useInvoiceActions } from '@/lib/hooks/useInvoiceActions';
import { apiGet } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import type { BookingDetail, Contract, Invoice, UserProfile } from '@/types/api';

export function useChecklistActions(bookingId: string) {
  const [, setSearchParams] = useSearchParams();
  const [pendingContract, setPendingContract] = useState<Contract | null>(null);

  const { data: booking } = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => apiGet<BookingDetail>(`/bookings/${bookingId}`),
    enabled: !!bookingId,
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ['bookingInvoices', bookingId],
    queryFn: () => apiGet<Invoice[]>(`/bookings/${bookingId}/invoices`),
    enabled: !!bookingId,
  });
  const { data: userProfile } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<UserProfile>('/me'),
    enabled: !!bookingId,
  });

  const actions = useBookingActions(bookingId);
  const contractActions = useContractActions(bookingId);
  const invoiceActions = useInvoiceActions(bookingId);

  function buildSetsDescription(): string {
    if (!booking?.sets?.length) return '';
    const formatById = new Map(
      (booking.packages ?? []).map((f) => [f.id, f.label]),
    );
    return booking.sets
      .map((s) => {
        const label = s.label ?? (s.packageId ? formatById.get(s.packageId) : null) ?? null;
        return label ? `${label} (${s.duration} min)` : `${s.duration} min`;
      })
      .join(', ');
  }

  function openCreateInvoice(prefill?: { isDeposit: boolean; amount?: number }) {
    const params: Record<string, string> = { sheet: 'invoice', isDeposit: String(prefill?.isDeposit ?? false) };
    if (prefill?.amount != null) params.amount = String(prefill.amount);
    const desc = buildSetsDescription();
    if (desc) params.description = desc;
    setSearchParams(params);
  }

  function handleChecklistAction(action: 'create_deposit_invoice' | 'create_balance_invoice' | 'create_contract') {
    if (action === 'create_contract') {
      contractActions.createContract((contract) => {
        setPendingContract(contract);
        setSearchParams({ sheet: 'contract' });
      });
      return;
    }
    const isDeposit = action === 'create_deposit_invoice';
    const invoiceType = isDeposit ? 'deposit' : 'balance';
    const existing = invoices.find((inv) => inv.isDeposit === isDeposit && inv.status !== 'VOID');

    // A draft is the user's to finish — open it so they can issue it. An already-issued invoice
    // is locked, so creating another means voiding the existing one first (ADR-0056).
    if (existing) {
      if (existing.status === 'DRAFT') {
        setSearchParams({ sheet: 'invoice', invoiceId: existing.id });
      } else {
        toast({
          title: `A ${invoiceType} invoice already exists — void it before creating a new one`,
          variant: 'destructive',
        });
      }
      return;
    }

    // No invoice yet: open the create sheet (nothing is persisted until the user saves or issues),
    // prefilling the deposit/balance amount when the fee and deposit percentage are both known.
    const fee = booking?.fee ? parseFloat(booking.fee) : null;
    const pct = userProfile?.depositPercentage;
    let amount: number | undefined;
    if (fee && pct) {
      const raw = isDeposit ? (fee * pct) / 100 : fee * (1 - pct / 100);
      amount = Math.round(raw * 100) / 100;
    }
    openCreateInvoice({ isDeposit, amount });
  }

  function handleMarkDone(key: 'mark_contract_signed' | 'mark_deposit_received') {
    if (key === 'mark_contract_signed') {
      if (booking?.activeContract) actions.markContractSigned(booking.activeContract.id);
    } else {
      const sentDeposit = invoices.find((inv) => inv.isDeposit && inv.status === 'SENT');
      if (sentDeposit) invoiceActions.markPaid(sentDeposit.id);
      else actions.markDepositReceived();
    }
  }

  return {
    handleChecklistAction,
    handleMarkDone,
    isActionPending: actions.isPending || invoiceActions.isMarkingPaid || contractActions.isCreatingContract,
    pendingContract,
    clearPendingContract: () => setPendingContract(null),
  };
}
