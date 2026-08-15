import { useInvoiceActions } from '@/lib/hooks/useInvoiceActions';
import { useSeriesInvoice } from '@/lib/hooks/useSeriesInvoice';
import { useSeriesInvoiceDocument } from '@/lib/hooks/useSeriesInvoiceDocument';
import { openPreviewPdf } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { SeriesInvoiceSection } from './InvoiceSection';
import type { Invoice } from '@/types/api';

interface SeriesInvoiceCardProps {
  seriesId: string;
  seriesLabel: string;
  onEdit: (invoice: Invoice) => void;
  onSend: (invoice: Invoice) => void;
  onMarkSent: (invoice: Invoice) => void;
}

export default function SeriesInvoiceCard({ seriesId, seriesLabel, onEdit, onSend, onMarkSent }: SeriesInvoiceCardProps) {
  const { data: invoice, isPending } = useSeriesInvoice(seriesId);
  const { data: invoiceDocument } = useSeriesInvoiceDocument(seriesId, invoice?.id);
  const actions = useInvoiceActions();

  function handleMarkSent(inv: Invoice) {
    if (inv.status === 'ISSUED') {
      actions.markSent(inv);
    } else {
      onMarkSent(inv);
    }
  }

  function handlePreview(inv: Invoice) {
    openPreviewPdf(`/series/${seriesId}/invoices/${inv.id}/preview.pdf`, () =>
      toast({ title: 'Failed to open preview', variant: 'destructive' }),
    );
  }

  return (
    <SeriesInvoiceSection
      seriesLabel={seriesLabel}
      invoice={invoice}
      isLoading={isPending}
      pdfUrl={invoiceDocument?.url ?? null}
      onCreateInvoice={() => actions.createSeriesInvoice(seriesId)}
      onEdit={onEdit}
      onPreview={handlePreview}
      onIssue={(inv) => actions.issue(inv)}
      onDelete={(inv) => actions.deleteInvoice(inv)}
      onSend={onSend}
      onMarkSent={handleMarkSent}
      onMarkPaid={(inv) => actions.markPaid(inv)}
      onVoid={(inv) => actions.voidInvoice(inv)}
      isCreatePending={actions.isCreating}
      isIssuePending={actions.isIssuing}
      isDeletePending={actions.isDeleting}
      isVoidPending={actions.isVoiding}
      isMarkSentPending={actions.isMarkingSent}
      isMarkPaidPending={actions.isMarkingPaid}
    />
  );
}
