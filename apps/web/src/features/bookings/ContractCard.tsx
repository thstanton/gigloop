import { useState } from 'react';
import { Download, Eye, FileText, Pencil, Plus, Send, ChevronDown } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { GhostButton } from '@/components/common/GhostButton';
import { IconButton } from '@/components/common/IconButton';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

interface ContractCardActionsProps {
  status: ContractStatus;
  contractDoc: Document | undefined;
  onEdit: () => void;
  onPreview: () => void;
  onSend: () => void;
  onVoidSent: () => void;
  onVoidSigned: () => void;
  onDelete: () => void;
}

function ContractCardActions({ status, contractDoc, onEdit, onPreview, onSend, onVoidSent, onVoidSigned, onDelete }: Readonly<ContractCardActionsProps>) {
  if (status === 'DRAFT') {
    return (
      <>
        <IconButton label="Send contract" onClick={onSend}><Send size={14} /></IconButton>
        <IconButton label="Edit contract" onClick={onEdit}><Pencil size={14} /></IconButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label="More actions"><ChevronDown size={14} /></IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onDelete} className="text-status-cancelled focus:text-status-cancelled">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    );
  }

  if (status === 'SENT') {
    return (
      <>
        <IconButton label="Preview contract" onClick={onPreview}><Eye size={14} /></IconButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label="More actions"><ChevronDown size={14} /></IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onVoidSent} className="text-status-cancelled focus:text-status-cancelled">Void contract</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    );
  }

  if (status === 'SIGNED') {
    return (
      <>
        <IconButton label="Preview contract" onClick={onPreview}><Eye size={14} /></IconButton>
        {contractDoc && (
          <a href={contractDoc.url} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-foreground transition-colors" aria-label="Download signed contract PDF">
            <Download size={14} />
          </a>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label="More actions"><ChevronDown size={14} /></IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onVoidSigned} className="text-status-cancelled focus:text-status-cancelled">Void contract</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    );
  }

  return null;
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
  const [confirmVoidOpen, setConfirmVoidOpen] = useState(false);
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

  return (
    <>
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
            {status && status !== 'VOID' && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <ContractCardActions
                  status={status}
                  contractDoc={contractDoc}
                  onEdit={onEdit}
                  onPreview={onPreview}
                  onSend={onSend}
                  onVoidSent={() => onVoid(false)}
                  onVoidSigned={() => setConfirmVoidOpen(true)}
                  onDelete={onDelete}
                />
              </div>
            )}
          </div>
        )}
      </Card>
      {confirmVoidOpen && (
        <Dialog open onOpenChange={() => setConfirmVoidOpen(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Void signed contract?</DialogTitle>
            </DialogHeader>
            <DialogDescription>
              This contract has been signed by the client. Voiding it will require them to sign a new contract.
            </DialogDescription>
            <div className="flex gap-2 justify-end mt-2">
              <Button variant="outline" onClick={() => setConfirmVoidOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={() => { onVoid(true); setConfirmVoidOpen(false); }}>Void contract</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
