import { DollarSign, Plus } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { GhostButton } from '@/components/common/GhostButton';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import InvoiceRow from './InvoiceRow';
import type { Invoice, Document, SeriesInvoice } from '@/types/api';

export interface SeriesInvoiceSectionProps {
  seriesLabel: string;
  invoice: SeriesInvoice | null | undefined;
  isLoading: boolean;
  onCreateInvoice: () => void;
  onEdit: (invoice: SeriesInvoice) => void;
  onDelete: (invoice: SeriesInvoice) => void;
  onSend: (invoice: SeriesInvoice) => void;
  onMarkSent: (invoice: SeriesInvoice) => void;
  onVoid: (invoice: SeriesInvoice) => void;
}

export function SeriesInvoiceSection({
  seriesLabel,
  invoice,
  isLoading,
  onCreateInvoice,
  onEdit,
  onDelete,
  onSend,
  onMarkSent,
  onVoid,
}: Readonly<SeriesInvoiceSectionProps>) {
  const notice = (
    <p className="text-sm text-muted px-0 pb-2">
      This invoice covers all bookings in <strong>{seriesLabel}</strong>. Changes affect the whole series.
    </p>
  );

  if (isLoading) {
    return (
      <Card title="Series Invoice">
        <div className="h-9 bg-border rounded animate-pulse" />
      </Card>
    );
  }

  if (!invoice) {
    return (
      <Card title="Series Invoice">
        {notice}
        <Button size="sm" onClick={onCreateInvoice}>
          Create series invoice
        </Button>
      </Card>
    );
  }

  return (
    <Card title="Series Invoice">
      {notice}
      <InvoiceRow
        invoice={invoice as unknown as Invoice}
        pdfUrl={null}
        onEdit={() => onEdit(invoice)}
        onDelete={() => onDelete(invoice)}
        onSend={() => onSend(invoice)}
        onMarkSent={() => onMarkSent(invoice)}
        onMarkPaid={() => {}}
        onVoid={() => onVoid(invoice)}
      />
    </Card>
  );
}

export interface InvoiceSectionProps {
  invoices: Invoice[];
  documents: Document[];
  isPending: boolean;
  onNewDepositInvoice: () => void;
  onNewBalanceInvoice: () => void;
  onEdit: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
  onSend: (invoice: Invoice) => void;
  onMarkSent: (invoice: Invoice) => void;
  onMarkPaid: (invoice: Invoice) => void;
  onVoid: (invoice: Invoice) => void;
}

export default function InvoiceSection({
  invoices,
  documents,
  isPending,
  onNewDepositInvoice,
  onNewBalanceInvoice,
  onEdit,
  onDelete,
  onSend,
  onMarkSent,
  onMarkPaid,
  onVoid,
}: Readonly<InvoiceSectionProps>) {
  const action = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <GhostButton variant="primary" size="xs" icon={<Plus size={12} />}>
          Add invoice
        </GhostButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onNewDepositInvoice}>Deposit invoice</DropdownMenuItem>
        <DropdownMenuItem onClick={onNewBalanceInvoice}>Balance invoice</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

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
        {invoices.map((inv) => (
          <InvoiceRow
            key={inv.id}
            invoice={inv}
            pdfUrl={documents.find((d) => d.type === 'INVOICE' && d.invoiceId === inv.id)?.url ?? null}
            onEdit={onEdit}
            onDelete={onDelete}
            onSend={onSend}
            onMarkSent={onMarkSent}
            onMarkPaid={onMarkPaid}
            onVoid={onVoid}
          />
        ))}
      </div>
    </Card>
  );
}
