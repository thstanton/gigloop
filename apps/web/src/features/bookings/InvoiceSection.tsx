import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, Plus } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { GhostButton } from '@/components/common/GhostButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import InvoiceRow from './InvoiceRow';
import { apiGet, apiGetBlob } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { useBookingActions } from '@/lib/hooks/useBookingActions';
import { useInvoiceActions } from '@/lib/hooks/useInvoiceActions';
import { activeInvoiceOf, coverTemplateFor, depositAmount, balanceAmount } from '@/lib/invoiceDerivations';
import { buildSetsDescription } from '@/lib/bookingSets';
import type { Invoice, Document, BookingDetail, UserProfile } from '@/types/api';

export interface SeriesInvoiceSectionProps {
  seriesLabel: string;
  invoice: Invoice | null | undefined;
  isLoading: boolean;
  onCreateInvoice: () => void;
  onEdit: (invoice: Invoice) => void;
  onIssue: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
  onSend: (invoice: Invoice) => void;
  onMarkSent: (invoice: Invoice) => void;
  onMarkPaid: (invoice: Invoice) => void;
  onVoid: (invoice: Invoice) => void;
  isCreatePending?: boolean;
  isIssuePending?: boolean;
  isDeletePending?: boolean;
  isVoidPending?: boolean;
  isMarkSentPending?: boolean;
  isMarkPaidPending?: boolean;
}

export function SeriesInvoiceSection({
  seriesLabel,
  invoice,
  isLoading,
  onCreateInvoice,
  onEdit,
  onIssue,
  onDelete,
  onSend,
  onMarkSent,
  onMarkPaid,
  onVoid,
  isCreatePending = false,
  isIssuePending = false,
  isDeletePending = false,
  isVoidPending = false,
  isMarkSentPending = false,
  isMarkPaidPending = false,
}: Readonly<SeriesInvoiceSectionProps>) {
  const notice = (
    <p className="text-sm text-muted px-0 pb-2">
      This invoice covers all bookings in <strong>{seriesLabel}</strong>. Changes affect the whole series.
    </p>
  );

  const createAction = !invoice ? (
    <GhostButton variant="primary" size="xs" icon={<Plus size={12} />} onClick={onCreateInvoice} disabled={isCreatePending}>
      {isCreatePending ? 'Creating…' : 'Create invoice'}
    </GhostButton>
  ) : null;

  if (isLoading) {
    return (
      <Card title="Series Invoice">
        <div className="h-9 bg-border rounded animate-pulse" />
      </Card>
    );
  }

  if (!invoice) {
    return (
      <Card title="Series Invoice" action={createAction}>
        {notice}
        <div className="flex items-center gap-2 text-muted py-1">
          <DollarSign size={14} />
          <span className="text-sm">No series invoice yet</span>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Series Invoice">
      {notice}
      <InvoiceRow
        invoice={invoice}
        pdfUrl={null}
        pending={{ isDeletePending, isVoidPending, isIssuePending, isMarkSentPending, isMarkPaidPending }}
        handlers={{
          onEdit,
          onPreview: () => {},
          onIssue,
          onDelete,
          onSend,
          onMarkSent,
          onMarkPaid,
          onVoid,
        }}
      />
    </Card>
  );
}

export interface InvoiceSectionProps {
  bookingId: string;
}

export default function InvoiceSection({ bookingId }: Readonly<InvoiceSectionProps>) {
  const [, setSearchParams] = useSearchParams();

  const { data: booking } = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => apiGet<BookingDetail>(`/bookings/${bookingId}`),
    enabled: !!bookingId,
  });

  const { data: userProfile } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<UserProfile>('/me'),
    enabled: !!bookingId,
  });

  const { data: invoices = [], isPending } = useQuery({
    queryKey: ['bookingInvoices', bookingId],
    queryFn: () => apiGet<Invoice[]>(`/bookings/${bookingId}/invoices`),
    enabled: !!bookingId,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['bookingDocuments', bookingId],
    queryFn: () => apiGet<Document[]>(`/bookings/${bookingId}/documents`),
    enabled: !!bookingId,
  });

  const actions = useBookingActions(bookingId);
  const invoiceActions = useInvoiceActions(bookingId);

  function openPreviewPdf(invoice: Invoice) {
    // The preview endpoint requires the Clerk bearer token, so a raw window.open() to it
    // 401s. Open the tab synchronously (preserves the user gesture), fetch the PDF with
    // auth, then point the tab at the blob.
    const win = window.open('', '_blank');
    apiGetBlob(`/bookings/${bookingId}/invoices/${invoice.id}/preview.pdf`)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        if (win) win.location.href = url;
        else window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      })
      .catch(() => {
        win?.close();
        toast({ title: 'Failed to open preview', variant: 'destructive' });
      });
  }

  function openCreateInvoice(prefill?: { isDeposit: boolean; amount?: number }) {
    const params: Record<string, string> = { sheet: 'invoice', isDeposit: String(prefill?.isDeposit ?? false) };
    if (prefill?.amount != null) params.amount = String(prefill.amount);
    const desc = buildSetsDescription(booking);
    if (desc) params.description = desc;
    setSearchParams(params);
  }

  function openEditInvoice(invoice: Invoice) {
    setSearchParams({ sheet: 'invoice', invoiceId: invoice.id });
  }

  function openSendInvoice(invoice: Invoice) {
    setSearchParams({ sheet: 'compose', templateType: coverTemplateFor(invoice) });
  }

  function newDepositInvoice() {
    const fee = booking?.fee ? parseFloat(booking.fee) : null;
    const pct = userProfile?.depositPercentage;
    openCreateInvoice({
      isDeposit: true,
      amount: fee && pct ? depositAmount(fee, pct) : undefined,
    });
  }

  function newBalanceInvoice() {
    const fee = booking?.fee ? parseFloat(booking.fee) : null;
    const pct = userProfile?.depositPercentage;
    openCreateInvoice({
      isDeposit: false,
      amount: fee && pct ? balanceAmount(fee, pct) : undefined,
    });
  }

  const hasNonVoidDeposit = !!activeInvoiceOf(true, invoices);
  const hasNonVoidBalance = !!activeInvoiceOf(false, invoices);
  const canAddInvoice = !hasNonVoidDeposit || !hasNonVoidBalance;

  const action = canAddInvoice ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <GhostButton variant="primary" size="xs" icon={<Plus size={12} />}>
          Add invoice
        </GhostButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {!hasNonVoidDeposit && (
          <DropdownMenuItem onClick={newDepositInvoice}>Deposit invoice</DropdownMenuItem>
        )}
        {!hasNonVoidBalance && (
          <DropdownMenuItem onClick={newBalanceInvoice}>Balance invoice</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  if (isPending) {
    return (
      <Card title="Invoices" action={action}>
        <div className="space-y-2 animate-pulse">
          {[1, 2].map((i) => <div key={i} className="h-9 bg-border rounded" />)}
        </div>
      </Card>
    );
  }

  if (invoices.length === 0) {
    return (
      <Card title="Invoices" action={action}>
        <div className="flex items-center gap-2 text-muted py-1">
          <DollarSign size={14} />
          <span className="text-sm">No invoices yet</span>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Invoices" action={action}>
      <div>
        {invoices.map((inv) => {
          const invoiceDoc = documents.find((d) => d.type === 'INVOICE' && d.invoiceId === inv.id);
          return (
          <InvoiceRow
            key={inv.id}
            invoice={inv}
            pdfUrl={invoiceDoc?.url ?? null}
            // The verdict comes from the backing INVOICE document (backend authority, ADR-0054).
            // A DRAFT has no PDF/document yet, so it is simply not on the portal until sent.
            portalVisibility={invoiceDoc?.portalVisibility ?? { visible: false, reason: 'until_sent' }}
            pending={{
              isDeletePending: actions.isDeletingInvoice,
              isVoidPending: invoiceActions.voidingInvoiceId === inv.id,
              isIssuePending: invoiceActions.issuingInvoiceId === inv.id,
              isMarkSentPending: invoiceActions.markingSentId === inv.id,
              isMarkPaidPending: invoiceActions.markingPaidId === inv.id,
            }}
            handlers={{
              onEdit: openEditInvoice,
              onPreview: openPreviewPdf,
              onIssue: (i) => invoiceActions.issue(i.id),
              onDelete: (i) => actions.deleteInvoice(i.id),
              onSend: openSendInvoice,
              onMarkSent: (i) => {
                if (i.status === 'ISSUED') {
                  invoiceActions.markSent(i.id);
                } else {
                  setSearchParams({ sheet: 'markSent', invoiceId: i.id });
                }
              },
              onMarkPaid: (i) => invoiceActions.markPaid(i.id),
              onVoid: (i) => invoiceActions.voidInvoice(i.id),
            }}
          />
          );
        })}
      </div>
    </Card>
  );
}
