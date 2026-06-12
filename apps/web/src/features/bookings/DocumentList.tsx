import { Trash2, FileText, Download, FolderOpen } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiDelete } from '@/lib/api';
import { RowActions } from '@/components/common/RowActions';
import type { RowAction } from '@/components/common/RowActions';
import type { Document, Invoice } from '@/types/api';

function getDocumentLabel(doc: Document, invoice: Invoice | undefined): string {
  if (doc.type === 'UPLOAD') return doc.name ?? 'Uploaded document';
  if (doc.type !== 'CONTRACT') {
    return invoice?.isDeposit ? 'Deposit invoice' : 'Balance invoice';
  }
  return doc.contractStatus === 'VOID' ? 'Contract [VOID]' : 'Contract';
}

async function downloadDocument(url: string, label: string) {
  const filename = `${label.toLowerCase().replace(' ', '-')}.pdf`;
  const res = await fetch(url);
  const blob = await res.blob();
  const a = window.document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

interface Props {
  bookingId: string;
  documents: Document[];
  invoices: Invoice[];
}

export function DocumentList({ bookingId, documents, invoices }: Props) {
  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/bookings/${bookingId}/documents/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookingDocuments', bookingId] }),
  });

  if (documents.length === 0) {
    return (
      <div className="flex items-center gap-2 text-muted py-1">
        <FolderOpen size={14} />
        <span className="text-sm">No documents yet</span>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {documents.map((doc) => {
        const invoice = invoices.find((i) => i.id === doc.invoiceId);
        const label = getDocumentLabel(doc, invoice);

        const actions: RowAction[] = [
          {
            label: 'Download',
            icon: <Download size={16} />,
            onClick: () => downloadDocument(doc.url, label),
          },
        ];

        if (doc.type === 'UPLOAD') {
          actions.push({
            label: 'Delete',
            icon: <Trash2 size={16} />,
            variant: 'destructive',
            confirmation: { title: 'Delete document?', description: 'This uploaded document will be permanently removed.' },
            onClick: () => deleteMutation.mutate(doc.id),
          });
        }

        return (
          <div key={doc.id} className="flex items-center gap-2 py-2">
            <FileText size={14} className="flex-shrink-0 text-muted mt-0.5 self-start" />
            <div className="flex flex-col min-w-0">
              <span className="text-sm text-foreground">{label}</span>
              {invoice?.invoiceNumber && (
                <span className="text-xs text-muted">{invoice.invoiceNumber}</span>
              )}
            </div>
            <span className="text-muted ml-auto text-xs shrink-0">
              {new Date(doc.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <RowActions actions={actions} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
