import { useState } from 'react';
import { useAuth } from '@clerk/react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useBooking } from '@/lib/hooks/useBooking';
import { useBookingActions } from '@/lib/hooks/useBookingActions';
import { useBookingInvoices } from '@/lib/hooks/useBookingInvoices';
import { useContractActions } from '@/lib/hooks/useContractActions';
import { useInvoiceActions } from '@/lib/hooks/useInvoiceActions';
import { apiGet } from '@/lib/api';
import type { Contract, UserProfile } from '@/types/api';

export function useChecklistActions(bookingId: string) {
  const { isLoaded } = useAuth();
  const [, setSearchParams] = useSearchParams();
  const [pendingContract, setPendingContract] = useState<Contract | null>(null);

  const { data: booking } = useBooking(bookingId);
  const { data: invoices = [] } = useBookingInvoices(bookingId);
  const { data: userProfile } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<UserProfile>('/me'),
    enabled: isLoaded,
  });

  const actions = useBookingActions(bookingId);
  const contractActions = useContractActions(bookingId);
  const invoiceActions = useInvoiceActions(bookingId);

  function buildSetsDescription(): string {
    if (!booking?.sets?.length) return '';
    const formatById = new Map(
      (booking.packages ?? []).map((f) => [f.packageId, f.package.label]),
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
    const fee = booking?.fee ? parseFloat(booking.fee) : null;
    const pct = userProfile?.depositPercentage;
    if (fee && pct) {
      const amount = isDeposit ? (fee * pct) / 100 : fee * (1 - pct / 100);
      actions.autoCreateInvoice({ isDeposit, amount: Math.round(amount * 100) / 100 });
    } else {
      openCreateInvoice({ isDeposit });
    }
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
    isActionPending: actions.isPending || invoiceActions.isMarkingPaid,
    pendingContract,
    clearPendingContract: () => setPendingContract(null),
  };
}
