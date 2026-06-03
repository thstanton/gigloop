import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/hooks/use-toast';
import { apiPost, apiPostVoid, apiDelete } from '@/lib/api';
import { useSeriesInvoice } from '@/lib/hooks/useSeriesInvoice';
import { SeriesInvoiceSection } from './InvoiceSection';
import type { SeriesInvoice } from '@/types/api';

interface SeriesInvoiceCardProps {
  seriesId: string;
  seriesLabel: string;
  onEdit: (invoice: SeriesInvoice) => void;
  onSend: (invoice: SeriesInvoice) => void;
  onMarkSent: (invoice: SeriesInvoice) => void;
}

export default function SeriesInvoiceCard({ seriesId, seriesLabel, onEdit, onSend, onMarkSent }: SeriesInvoiceCardProps) {
  const queryClient = useQueryClient();
  const { data: invoice, isPending } = useSeriesInvoice(seriesId);

  const invalidateSeriesInvoice = () => queryClient.invalidateQueries({ queryKey: ['seriesInvoice', seriesId] });

  const createSeriesInvoiceMutation = useMutation({
    mutationFn: () => apiPost<SeriesInvoice>(`/series/${seriesId}/invoices`, {}),
    onSuccess: invalidateSeriesInvoice,
    onError: () => toast({ title: 'Failed to create series invoice', variant: 'destructive' }),
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

  return (
    <SeriesInvoiceSection
      seriesLabel={seriesLabel}
      invoice={invoice}
      isLoading={isPending}
      onCreateInvoice={() => createSeriesInvoiceMutation.mutate()}
      onEdit={onEdit}
      onDelete={(inv) => deleteSeriesInvoiceMutation.mutate(inv.id)}
      onSend={onSend}
      onMarkSent={onMarkSent}
      onMarkPaid={(inv) => markSeriesInvoicePaidMutation.mutate(inv.id)}
      onVoid={(inv) => voidSeriesInvoiceMutation.mutate(inv.id)}
    />
  );
}
