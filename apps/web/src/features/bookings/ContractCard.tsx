import { Download, Eye, FileText, Pencil, Plus, Send } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { GhostButton } from '@/components/common/GhostButton';
import { RowActions } from '@/components/common/RowActions';
import type { RowAction } from '@/components/common/RowActions';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/formatters';
import type { BookingDetail, Contract, ContractStatus, Document } from '@/types/api';

function getContractDate(contract: Contract, status: ContractStatus | null): string | null {
  if (status === 'SIGNED' && contract.signedAt) return formatDate(contract.signedAt);
  if (status === 'SENT' && contract.updatedAt) return formatDate(contract.updatedAt);
  if (contract.createdAt) return formatDate(contract.createdAt);
  return null;
}

const CONTRACT_PILL_CLASSES: Record<string, string> = {
  DRAFT:  'bg-status-enquiry/12 text-status-enquiry border-l-status-enquiry',
  SENT:   'bg-status-confirmed/12 text-status-confirmed border-l-status-confirmed',
  SIGNED: 'bg-status-ready/12 text-status-ready border-l-status-ready',
  VOID:   'bg-muted/20 text-muted border-l-muted',
};

const CONTRACT_PILL_LABELS: Record<string, string> = {
  DRAFT:  'Draft',
  SENT:   'Sent',
  SIGNED: 'Signed',
  VOID:   'Void',
};

function getContractActions(
  status: ContractStatus,
  contractDoc: Document | undefined,
  handlers: {
    onEdit: () => void;
    onPreview: () => void;
    onSend: () => void;
    onVoid: (confirmSignedVoid: boolean) => void;
    onDelete: () => void;
  }
): RowAction[] {
  const { onEdit, onPreview, onSend, onVoid, onDelete } = handlers;

  if (status === 'DRAFT') {
    return [
      { label: 'Send', icon: <Send size={16} />, onClick: onSend },
      { label: 'Edit', icon: <Pencil size={16} />, onClick: onEdit },
      {
        label: 'Delete',
        onClick: onDelete,
        variant: 'destructive',
        confirmation: { title: 'Delete contract?', description: 'This draft will be permanently removed.' },
      },
    ];
  }

  if (status === 'SENT') {
    return [
      { label: 'Preview', icon: <Eye size={16} />, onClick: onPreview },
      {
        label: 'Void',
        onClick: () => onVoid(false),
        variant: 'destructive',
        confirmation: { title: 'Void contract?', description: 'The contract will be voided. You can create a new one if needed.' },
      },
    ];
  }

  if (status === 'SIGNED') {
    const actions: RowAction[] = [
      { label: 'Preview', icon: <Eye size={16} />, onClick: onPreview },
    ];
    if (contractDoc) {
      actions.push({
        label: 'Download',
        icon: <Download size={16} />,
        onClick: () => window.open(contractDoc.url, '_blank', 'noopener,noreferrer'),
      });
    }
    actions.push({
      label: 'Void',
      onClick: () => onVoid(true),
      variant: 'destructive',
      confirmation: {
        title: 'Void signed contract?',
        description: 'This contract has been signed by the client. Voiding it will require them to sign a new contract.',
      },
    });
    return actions;
  }

  return [];
}

export interface ContractCardProps {
  booking: BookingDetail;
  documents: Document[];
  isCreating: boolean;
  onCreateContract: () => void;
  onEdit: () => void;
  onPreview: () => void;
  onSend: () => void;
  onVoid: (confirmSignedVoid: boolean) => void;
  onDelete: () => void;
}

export default function ContractCard({
  booking,
  documents,
  isCreating,
  onCreateContract,
  onEdit,
  onPreview,
  onSend,
  onVoid,
  onDelete,
}: Readonly<ContractCardProps>) {
  const contract = booking.activeContract;
  const status = contract?.status ?? null;
  const isVoid = status === 'VOID';
  const isEmpty = !contract;
  const contractDoc = documents.find((d) => d.type === 'CONTRACT' && d.contractStatus !== 'VOID');
  const contractDate = contract ? getContractDate(contract, status) : null;

  const headerAction = (isEmpty || isVoid) ? (
    <GhostButton onClick={onCreateContract} disabled={isCreating} variant="primary" size="xs" icon={<Plus size={12} />}>
      {isCreating ? 'Creating…' : 'Create contract'}
    </GhostButton>
  ) : null;

  const actions = status && status !== 'VOID'
    ? getContractActions(status, contractDoc, { onEdit, onPreview, onSend, onVoid, onDelete })
    : null;

  return (
    <Card title="Contract" action={headerAction}>
      {isEmpty ? (
        <div className="flex items-center gap-2 text-muted py-1">
          <FileText size={14} />
          <span className="text-sm">No contracts yet</span>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3 py-0.5">
          <div className="min-w-0">
            <p className={cn('text-sm', isVoid ? 'text-muted line-through' : 'text-foreground')}>Contract</p>
            {contractDate && <p className="text-xs text-muted mt-0.5">{contractDate}</p>}
            <div className="mt-1">
              <span className={cn('inline-flex items-center border-l-[3px] pl-2 pr-2.5 py-0.5 text-xs font-medium', CONTRACT_PILL_CLASSES[status ?? ''] ?? '')}>
                {CONTRACT_PILL_LABELS[status ?? ''] ?? status}
              </span>
            </div>
          </div>
          {actions && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <RowActions
                actions={actions}
                label="Contract"
                sublabel={[CONTRACT_PILL_LABELS[status!], contractDate].filter(Boolean).join(' · ')}
              />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
