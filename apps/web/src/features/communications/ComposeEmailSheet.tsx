import { EditorContent, type Editor } from '@tiptap/react';
import { AlertTriangle, EyeOff, Paperclip } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { InlineHint } from '@/components/common/InlineHint';
import { TEMPLATE_DISPLAY } from '@/features/templates/templateMeta';
import { formatMissingVariables, type AttachmentState } from './composeHelpers';
import { useComposeEmail } from './useComposeEmail';
import type { BookingDetail, ChecklistItem, Invoice, Template } from '@/types/api';

interface Props {
  bookingId: string;
  booking: BookingDetail;
  invoices: Invoice[];
  checklist: ChecklistItem[];
  defaultPaymentTermsDays: number | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTemplateType?: string;
  onAfterSend?: (templateType: string | null) => void;
  /** #757 Hint A action: create the contract, then open its editor (same as the checklist shortcut). */
  onCreateContract: () => void;
  /** True while the create-contract mutation is in flight — disables hint A to prevent a double-fire. */
  creatingContract: boolean;
  /** #757 Hint B action: route to the pre-filled deposit-invoice sheet. */
  createDepositInvoiceHref: string;
}

// ─── Presentational fields ──────────────────────────────────────────────────

function RecipientField({ customer }: { customer: BookingDetail['customer'] }) {
  return (
    <div>
      <p className="text-xs text-muted mb-1">To</p>
      {customer.email ? (
        <p className="text-sm text-foreground">
          {customer.name}
          <span className="text-muted ml-1">({customer.email})</span>
        </p>
      ) : (
        <p className="text-sm text-status-cancelled">
          No email on file for {customer.name} — add one before sending.
        </p>
      )}
    </div>
  );
}

function TemplatePicker({
  templates,
  value,
  onChange,
  musicFormPublished,
}: {
  templates: Template[];
  value: string;
  onChange: (id: string) => void;
  // #533 / #631: the music-form invite cannot be sent until the form is published.
  musicFormPublished: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted mb-1">Template</p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select a template" />
        </SelectTrigger>
        <SelectContent>
          {templates.map((t) => {
            const blockedMusicInvite = t.builtInType === 'music_form_invite' && !musicFormPublished;
            const label = t.builtInType ? TEMPLATE_DISPLAY[t.builtInType].name : t.name;
            return (
              <SelectItem key={t.id} value={t.id} disabled={blockedMusicInvite}>
                {blockedMusicInvite ? `${label} — publish the form first` : label}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

function AttachmentIndicator({ state }: { state: AttachmentState }) {
  if (state === null) return null;
  if (state.kind === 'present') {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
        <Paperclip size={14} className="flex-shrink-0 text-muted" />
        <span>{state.filename}</span>
      </div>
    );
  }
  return (
    <div className="flex gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-800">
      <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
      <span>{state.message}</span>
    </div>
  );
}

function InvoiceDateFields({
  issueDate,
  onIssueChange,
  dueDate,
  onDueChange,
}: {
  issueDate: string;
  onIssueChange: (value: string) => void;
  dueDate: string;
  onDueChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <label className="text-xs text-muted">Issue date</label>
        <DatePicker value={issueDate} onChange={onIssueChange} />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs text-muted">Due date (optional)</label>
        <DatePicker value={dueDate} onChange={onDueChange} placeholder="No due date" />
      </div>
    </div>
  );
}

function MissingVariablesWarning({ variables }: { variables: string[] }) {
  if (variables.length === 0) return null;
  return (
    <div className="flex gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-800">
      <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
      <span>
        <strong>{formatMissingVariables(variables)}</strong>{' '}
        {variables.length === 1 ? 'is' : 'are'} missing from this email. Update the booking before
        sending.
      </span>
    </div>
  );
}

function SubjectField({
  rendering,
  subject,
  onChange,
}: {
  rendering: boolean;
  subject: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="text-xs text-muted mb-1">Subject</p>
      {rendering ? (
        <div className="h-9 rounded-md border border-border bg-background px-3 py-2 flex items-center">
          <div className="animate-pulse h-3 w-2/3 rounded bg-muted" />
        </div>
      ) : (
        <input
          type="text"
          value={subject}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      )}
    </div>
  );
}

function BodyField({ rendering, editor }: { rendering: boolean; editor: Editor | null }) {
  return (
    <div>
      <p className="text-xs text-muted mb-1">Body</p>
      <div className="rounded-md border border-border bg-background px-3 py-2 tiptap-content">
        {rendering ? (
          <div className="animate-pulse space-y-2 min-h-48 py-1">
            <div className="h-3 rounded bg-muted w-full" />
            <div className="h-3 rounded bg-muted w-5/6" />
            <div className="h-3 rounded bg-muted w-4/6" />
            <div className="h-3 rounded bg-muted w-full mt-4" />
            <div className="h-3 rounded bg-muted w-3/4" />
            <div className="h-3 rounded bg-muted w-full" />
            <div className="h-3 rounded bg-muted w-2/3" />
          </div>
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>
    </div>
  );
}

// The three teaching hints the compose sheet can surface — grouped so the sheet body stays flat.
function ComposeHints({
  bookingId,
  vm,
  onCreateContract,
  creatingContract,
  createDepositInvoiceHref,
}: {
  bookingId: string;
  vm: ReturnType<typeof useComposeEmail>;
  onCreateContract: () => void;
  creatingContract: boolean;
  createDepositInvoiceHref: string;
}) {
  return (
    <>
      {vm.musicInviteBlocked && (
        <InlineHint
          icon={<EyeOff size={14} />}
          actionLabel="Publish the form"
          href={`/admin/bookings/${bookingId}?sheet=musicTweak`}
        >
          This music form isn't published yet, so the client can't see it.
        </InlineHint>
      )}
      {vm.showCreateContractHint && (
        <InlineHint
          actionLabel={creatingContract ? 'Creating…' : 'Create the contract'}
          onClick={onCreateContract}
          disabled={creatingContract}
        >
          There's no contract yet — you can send it with this invoice in one email.
        </InlineHint>
      )}
      {vm.showCreateDepositHint && (
        <InlineHint actionLabel="Create the deposit invoice" href={createDepositInvoiceHref}>
          You can send the contract and deposit invoice together in one email.
        </InlineHint>
      )}
    </>
  );
}

// ─── Body ─────────────────────────────────────────────────────────────────────

function ComposeEmailSheetBody(props: Props) {
  const { bookingId, booking, onOpenChange, onCreateContract, creatingContract, createDepositInvoiceHref } = props;
  const vm = useComposeEmail(props);

  return (
    <>
      <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
        <SheetTitle>Compose email</SheetTitle>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <RecipientField customer={booking.customer} />
        <TemplatePicker
          templates={vm.emailTemplates}
          value={vm.selectedTemplateId}
          onChange={vm.setSelectedTemplateId}
          musicFormPublished={booking.portalVisibility.musicForm?.visible ?? false}
        />
        <AttachmentIndicator state={vm.attachmentState} />
        {vm.showDateFields && (
          <InvoiceDateFields
            issueDate={vm.formIssueDate}
            onIssueChange={vm.setFormIssueDate}
            dueDate={vm.formDueDate}
            onDueChange={vm.setFormDueDate}
          />
        )}
        <MissingVariablesWarning variables={vm.missingVariables} />
        {vm.selectedTemplateId && (
          <SubjectField rendering={vm.rendering} subject={vm.subject} onChange={vm.setSubject} />
        )}
        {vm.selectedTemplateId && <BodyField rendering={vm.rendering} editor={vm.editor} />}
        <ComposeHints
          bookingId={bookingId}
          vm={vm}
          onCreateContract={onCreateContract}
          creatingContract={creatingContract}
          createDepositInvoiceHref={createDepositInvoiceHref}
        />
        {vm.sendError && <p className="text-sm text-status-cancelled">{vm.sendError}</p>}
      </div>

      <div className="px-6 py-4 border-t border-border flex gap-3">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={vm.sending}>
          Cancel
        </Button>
        <Button onClick={vm.send} disabled={!vm.canSend}>
          {vm.sending ? 'Sending…' : 'Send'}
        </Button>
      </div>
    </>
  );
}

export default function ComposeEmailSheet({ open, onOpenChange, ...rest }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col w-full sm:max-w-lg p-0">
        {open && <ComposeEmailSheetBody open={open} onOpenChange={onOpenChange} {...rest} />}
      </SheetContent>
    </Sheet>
  );
}
