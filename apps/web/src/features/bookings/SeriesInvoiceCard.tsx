import { useInvoiceActions } from '@/lib/hooks/useInvoiceActions';
import { useSeriesInvoice } from '@/lib/hooks/useSeriesInvoice';
import { useSeriesInvoiceDocument } from '@/lib/hooks/useSeriesInvoiceDocument';
import { openGeneratedPdf } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { SeriesInvoiceSection } from './InvoiceSection';
import { MarkPaidDialog } from './MarkPaidDialog';
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
  // Named `storedPdf`, not `document` — that would shadow the DOM global inside this component.
  const { data: storedPdf } = useSeriesInvoiceDocument(seriesId, invoice);
  const actions = useInvoiceActions();

  function handleMarkSent(inv: Invoice) {
    if (inv.status === 'ISSUED') {
      actions.markSent(inv);
    } else {
      onMarkSent(inv);
    }
  }

  // A DRAFT has no stored PDF — preview regenerates it from live data. Once issued, the row
  // offers Download against the stored artifact instead, so the musician sees exactly what the
  // client received rather than a fresh render (#830).
  function handlePreview(inv: Invoice) {
    openGeneratedPdf(`/series/${seriesId}/invoices/${inv.id}/preview.pdf`, () =>
      toast({ title: 'Failed to open preview', variant: 'destructive' }),
    );
  }

  return (
    <>
      <SeriesInvoiceSection
        seriesLabel={seriesLabel}
        invoice={invoice}
        isLoading={isPending}
        pdfUrl={storedPdf?.url ?? null}
        onCreateInvoice={() => actions.createSeriesInvoice(seriesId)}
        onEdit={onEdit}
        onPreview={handlePreview}
        onIssue={(inv) => actions.issue(inv)}
        onDelete={(inv) => actions.deleteInvoice(inv)}
        onSend={onSend}
        onMarkSent={handleMarkSent}
        onMarkPaid={(inv) => actions.requestMarkPaid(inv)}
        onVoid={(inv) => actions.voidInvoice(inv)}
        isCreatePending={actions.isCreating}
        isIssuePending={actions.isIssuing}
        isDeletePending={actions.isDeleting}
        isVoidPending={actions.isVoiding}
        isMarkSentPending={actions.isMarkingSent}
        isMarkPaidPending={actions.isMarkingPaid}
      />
      <MarkPaidDialog {...actions.markPaidDialog} />
    </>
  );
}
