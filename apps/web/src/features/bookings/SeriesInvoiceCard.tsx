import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/hooks/use-toast';
import { apiPost, apiPostVoid, apiDelete } from '@/lib/api';
import { useSeriesInvoice } from '@/lib/hooks/useSeriesInvoice';
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
  const queryClient = useQueryClient();
  const { data: invoice, isPending } = useSeriesInvoice(seriesId);

  const invalidateSeriesInvoice = () => queryClient.invalidateQueries({ queryKey: ['seriesInvoice', seriesId] });

  const createSeriesInvoiceMutation = useMutation({
    mutationFn: () => apiPost<Invoice>(`/series/${seriesId}/invoices`, {}),
    onSuccess: invalidateSeriesInvoice,
    onError: () => toast({ title: 'Failed to create series invoice', variant: 'destructive' }),
  });

  const issueSeriesInvoiceMutation = useMutation({
    mutationFn: (invoiceId: string) => apiPost<Invoice>(`/series/${seriesId}/invoices/${invoiceId}/issue`, {}),
    onSuccess: invalidateSeriesInvoice,
    onError: () => toast({ title: 'Failed to issue series invoice', variant: 'destructive' }),
  });

  const voidSeriesInvoiceMutation = useMutation({
    mutationFn: (invoiceId: string) => apiPostVoid(`/series/${seriesId}/invoices/${invoiceId}/void`, {}),
    onSuccess: invalidateSeriesInvoice,
    onError: () => toast({ title: 'Failed to void series invoice', variant: 'destructive' }),
  });

  const deleteSeriesInvoiceMutation = useMutation({
    mutationFn: (invoiceId: string) => apiDelete(`/series/${seriesId}/invoices/${invoiceId}`),
    onSuccess: invalidateSeriesInvoice,
    onError: () => toast({ title: 'Failed to delete series invoice', variant: 'destructive' }),
  });

  const markSeriesInvoicePaidMutation = useMutation({
    mutationFn: (invoiceId: string) => apiPost(`/series/${seriesId}/invoices/${invoiceId}/mark-paid`, {}),
    onSuccess: invalidateSeriesInvoice,
    onError: () => toast({ title: 'Failed to mark series invoice as paid', variant: 'destructive' }),
  });

  const markSeriesInvoiceSentMutation = useMutation({
    mutationFn: (invoiceId: string) => apiPost(`/series/${seriesId}/invoices/${invoiceId}/mark-sent`, {}),
    onSuccess: invalidateSeriesInvoice,
    onError: () => toast({ title: 'Failed to mark series invoice as sent', variant: 'destructive' }),
  });

  function handleMarkSent(inv: Invoice) {
    if (inv.status === 'ISSUED') {
      markSeriesInvoiceSentMutation.mutate(inv.id);
    } else {
      onMarkSent(inv);
    }
  }

  return (
    <SeriesInvoiceSection
      seriesLabel={seriesLabel}
      invoice={invoice}
      isLoading={isPending}
      onCreateInvoice={() => createSeriesInvoiceMutation.mutate()}
      onEdit={onEdit}
      onIssue={(inv) => issueSeriesInvoiceMutation.mutate(inv.id)}
      onDelete={(inv) => deleteSeriesInvoiceMutation.mutate(inv.id)}
      onSend={onSend}
      onMarkSent={handleMarkSent}
      onMarkPaid={(inv) => markSeriesInvoicePaidMutation.mutate(inv.id)}
      onVoid={(inv) => voidSeriesInvoiceMutation.mutate(inv.id)}
      isCreatePending={createSeriesInvoiceMutation.isPending}
      isIssuePending={issueSeriesInvoiceMutation.isPending}
      isDeletePending={deleteSeriesInvoiceMutation.isPending}
      isVoidPending={voidSeriesInvoiceMutation.isPending}
      isMarkSentPending={markSeriesInvoiceSentMutation.isPending}
      isMarkPaidPending={markSeriesInvoicePaidMutation.isPending}
    />
  );
}
