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
import type { Invoice, Document } from '@/types/api';

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
}: InvoiceSectionProps) {
  const action = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <GhostButton variant="primary" size="xs" icon={<Plus size={12} />}>
          Add invoice
        </GhostButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onNewDepositInvoice}>
          Deposit invoice
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onNewBalanceInvoice}>
          Balance invoice
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <Card title="Invoices" action={action}>
      {isPending ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2].map((i) => <div key={i} className="h-9 bg-border rounded" />)}
        </div>
      ) : invoices.length === 0 ? (
        <div className="flex items-center gap-2 text-muted py-1">
          <DollarSign size={14} />
          <span className="text-sm">No invoices yet</span>
        </div>
      ) : (
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
      )}
    </Card>
  );
}
