import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import { useBookingActions } from '@/lib/hooks/useBookingActions';
import { useContractActions } from '@/lib/hooks/useContractActions';
import { useInvoiceActions } from '@/lib/hooks/useInvoiceActions';
import { apiGet } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { activeInvoiceOf, sentInvoiceOf, depositAmount, balanceDefaultAmount } from '@/lib/invoiceDerivations';
import { buildSetsDescription } from '@/lib/bookingSets';
import type { BookingDetail, Contract, Invoice, UserProfile } from '@/types/api';

export function useChecklistActions(bookingId: string) {
  const [, setSearchParams] = useSearchParams();
  const [pendingContract, setPendingContract] = useState<Contract | null>(null);
  // Gate every query on Clerk being initialised, or a page refresh can fire them before the JWT
  // is ready and they 401 (project data-fetching rule). The `['me']` query keys off the signed-in
  // user, not the booking, so it gates on isSignedIn rather than bookingId.
  const { isLoaded, isSignedIn } = useAuth();

  const { data: booking } = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => apiGet<BookingDetail>(`/bookings/${bookingId}`),
    enabled: isLoaded && !!bookingId,
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ['bookingInvoices', bookingId],
    queryFn: () => apiGet<Invoice[]>(`/bookings/${bookingId}/invoices`),
    enabled: isLoaded && !!bookingId,
  });
  const { data: userProfile } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<UserProfile>('/me'),
    enabled: isLoaded && !!isSignedIn,
  });

  const actions = useBookingActions(bookingId);
  const contractActions = useContractActions(bookingId);
  const invoiceActions = useInvoiceActions();

  function openCreateInvoice(prefill?: { isDeposit: boolean; amount?: number }) {
    const params: Record<string, string> = { sheet: 'invoice', isDeposit: String(prefill?.isDeposit ?? false) };
    if (prefill?.amount != null) params.amount = String(prefill.amount);
    const desc = buildSetsDescription(booking);
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
    const existing = activeInvoiceOf(isDeposit, invoices);

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
    // prefilling the amount. A deposit pre-fills from the default percentage (a convenience); a
    // balance pre-fills from fee − invoiced deposit, reading the actual deposit invoice rather than
    // the percentage. See CONTEXT.md → Invoice → "Invoiced deposit — one rule, two consumers".
    const fee = booking?.fee ? parseFloat(booking.fee) : null;
    const pct = userProfile?.depositPercentage;
    let amount: number | undefined;
    if (fee && !isDeposit) amount = balanceDefaultAmount(fee, invoices);
    else if (fee && pct) amount = depositAmount(fee, pct);
    openCreateInvoice({ isDeposit, amount });
  }

  // Mark the sent invoice of the given type paid — the received steps' "Mark as paid" action (#653).
  // Opens the mark-paid dialog (date + reference, ADR-0068); returns false when there is no sent
  // invoice to mark, so the caller can pick a fallback.
  function markSentInvoicePaid(isDeposit: boolean): boolean {
    const sent = sentInvoiceOf(isDeposit, invoices);
    if (!sent) return false;
    invoiceActions.requestMarkPaid(sent);
    return true;
  }

  function handleMarkDone(key: 'mark_contract_signed' | 'mark_deposit_received' | 'mark_balance_received') {
    if (key === 'mark_contract_signed') {
      if (booking?.activeContract) actions.markContractSigned(booking.activeContract.id);
    } else {
      // Both received steps mark the sent invoice of their type paid (TIM-47 / ADR-0068). No
      // non-invoice fallback for either — a payment taken without an invoice is not money as far
      // as GigLoop is concerned; spine ordering guarantees a sent invoice by this step, and the
      // goal's ⋯ "Mark complete" remains the escape hatch.
      markSentInvoicePaid(key === 'mark_deposit_received');
    }
  }

  return {
    handleChecklistAction,
    handleMarkDone,
    isActionPending: actions.isPending || invoiceActions.isMarkingPaid || contractActions.isCreatingContract,
    pendingContract,
    clearPendingContract: () => setPendingContract(null),
    // Props for the MarkPaidDialog the checklist surface renders (its "Mark as paid" CTA opens it).
    markPaidDialog: invoiceActions.markPaidDialog,
  };
}
