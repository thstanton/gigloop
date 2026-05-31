import { Card } from '@/components/common/Card';
import ChecklistSection from '@/features/bookings/ChecklistSection';
import ContractCard from '@/features/bookings/ContractCard';
import InvoiceSection from '@/features/bookings/InvoiceSection';
import { DocumentList } from '@/features/bookings/DocumentList';
import CommunicationsSection from '@/features/bookings/CommunicationsSection';
import type {
  BookingDetail,
  ChecklistItem,
  Communication,
  Document,
  Invoice,
} from '@/types/api';

interface Props {
  booking: BookingDetail;
  invoices: Invoice[];
  documents: Document[];
  communications: Communication[];
  checklist: ChecklistItem[];
  checklistLoading: boolean;
  contractShortcutType: string;
  isCreatingContract: boolean;
  invoicesPending: boolean;
  isAddingItem: boolean;
  isActionPending: boolean;
  onToggleChecklist: (itemId: string, state: 'COMPLETE' | 'PENDING') => void;
  onChecklistAction: (action: 'create_deposit_invoice' | 'create_balance_invoice' | 'create_contract') => void;
  onOpenCompose: (templateType?: string) => void;
  onMarkDone: (key: 'mark_contract_signed' | 'mark_deposit_received') => void;
  onAddItem: (data: { label: string; requiredForStatus: string | null; dueDate: string | null }) => void;
  onCreateContract: () => void;
  onEditContract: () => void;
  onPreviewContract: () => void;
  onSendContract: () => void;
  onVoidContract: (confirmSignedVoid: boolean) => void;
  onDeleteContract: () => void;
  onNewDepositInvoice: () => void;
  onNewBalanceInvoice: () => void;
  onEditInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (invoice: Invoice) => void;
  onSendInvoice: (invoice: Invoice) => void;
  onMarkSentInvoice: (invoice: Invoice | undefined) => void;
  onMarkPaidInvoice: (invoice: Invoice) => void;
  onVoidInvoice: (invoice: Invoice) => void;
  onCompose: () => void;
}

export function BookingRightColumn({
  booking, invoices, documents, communications,
  checklist, checklistLoading, contractShortcutType,
  isCreatingContract, invoicesPending, isAddingItem, isActionPending,
  onToggleChecklist, onChecklistAction, onOpenCompose, onMarkDone, onAddItem,
  onCreateContract, onEditContract, onPreviewContract, onSendContract,
  onVoidContract, onDeleteContract,
  onNewDepositInvoice, onNewBalanceInvoice,
  onEditInvoice, onDeleteInvoice, onSendInvoice,
  onMarkSentInvoice, onMarkPaidInvoice, onVoidInvoice,
  onCompose,
}: Props) {
  const isCancelled = booking.status === 'CANCELLED';

  return (
    <div className="mt-8 md:mt-0 space-y-6">
      {!isCancelled && (
        <ChecklistSection
          items={checklist}
          isLoading={checklistLoading}
          bookingStatus={booking.status}
          contractTemplateType={contractShortcutType}
          onToggle={onToggleChecklist}
          onChecklistAction={onChecklistAction}
          onOpenCompose={onOpenCompose}
          onMarkDone={onMarkDone}
          onAddItem={onAddItem}
          isAddingItem={isAddingItem}
          isActionPending={isActionPending}
        />
      )}
      {!isCancelled && (
        <ContractCard
          booking={booking}
          documents={documents}
          isCreating={isCreatingContract}
          onCreateContract={onCreateContract}
          onEdit={onEditContract}
          onPreview={onPreviewContract}
          onSend={onSendContract}
          onVoid={onVoidContract}
          onDelete={onDeleteContract}
        />
      )}
      <InvoiceSection
        invoices={invoices}
        documents={documents}
        isPending={invoicesPending}
        onNewDepositInvoice={onNewDepositInvoice}
        onNewBalanceInvoice={onNewBalanceInvoice}
        onEdit={onEditInvoice}
        onDelete={onDeleteInvoice}
        onSend={onSendInvoice}
        onMarkSent={onMarkSentInvoice}
        onMarkPaid={onMarkPaidInvoice}
        onVoid={onVoidInvoice}
      />
      <Card title="Documents">
        <DocumentList documents={documents} invoices={invoices} />
      </Card>
      <CommunicationsSection communications={communications} onCompose={onCompose} />
    </div>
  );
}
