import { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { AlertTriangle } from 'lucide-react';
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
import { apiGet, apiPostVoid } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { BUILT_IN_EMAIL_TYPES, TEMPLATE_DISPLAY, VAR_LABELS } from '@/features/templates/templateMeta';
import type { BookingDetail, BuiltInTemplateType, Invoice, Template } from '@/types/api';

interface RenderResult {
  subject: string;
  body: string;
  missingVariables: string[];
}

interface Props {
  bookingId: string;
  booking: BookingDetail;
  invoices: Invoice[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTemplateType?: string;
}

function getInvoiceIdForTemplate(
  type: BuiltInTemplateType | null,
  invoices: Invoice[],
): string | undefined {
  if (type === 'deposit_invoice_cover' || type === 'contract_and_deposit_cover') {
    return invoices.find((i) => i.isDeposit)?.id;
  }
  if (type === 'balance_invoice_cover') {
    return invoices.find((i) => !i.isDeposit)?.id;
  }
  return undefined;
}

function shouldHideTemplate(
  type: BuiltInTemplateType,
  invoices: Invoice[],
  bookingDate: string,
): boolean {
  if (
    (type === 'deposit_invoice_cover' || type === 'contract_and_deposit_cover') &&
    !invoices.some((i) => i.isDeposit)
  ) return true;
  if (type === 'balance_invoice_cover' && !invoices.some((i) => !i.isDeposit)) return true;
  if (type === 'thank_you') {
    const date = new Date(bookingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today;
  }
  return false;
}

function formatMissingVariables(keys: string[]): string {
  const labels = keys.map((k) => VAR_LABELS[k] ?? k);
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

export default function ComposeEmailSheet({
  bookingId,
  booking,
  invoices,
  open,
  onOpenChange,
  initialTemplateType,
}: Props) {
  const { isLoaded } = useAuth();
  const queryClient = useQueryClient();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [missingVariables, setMissingVariables] = useState<string[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: '',
    editorProps: {
      attributes: {
        class: 'min-h-48 focus:outline-none text-sm leading-relaxed',
      },
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: () => apiGet<Template[]>('/templates'),
    enabled: isLoaded && open,
  });

  // Pre-select template by type once templates load, and reset when sheet opens
  useEffect(() => {
    if (open) {
      setSubject('');
      setMissingVariables([]);
      setSendError(null);
      editor?.commands.setContent('');
      if (initialTemplateType && templates.length > 0) {
        const match = templates.find((t) => t.builtInType === initialTemplateType);
        setSelectedTemplateId(match?.id ?? '');
      } else if (!initialTemplateType) {
        setSelectedTemplateId('');
      }
    }
  }, [open, initialTemplateType, templates.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const emailTemplates = templates.filter(
    (t) =>
      t.builtInType &&
      BUILT_IN_EMAIL_TYPES.includes(t.builtInType) &&
      !shouldHideTemplate(t.builtInType, invoices, booking.date),
  );

  const selectedTemplate = emailTemplates.find((t) => t.id === selectedTemplateId) ?? null;
  const selectedType = selectedTemplate?.builtInType ?? null;
  const invoiceId = getInvoiceIdForTemplate(selectedType, invoices);

  const { data: renderResult, isFetching: rendering } = useQuery({
    queryKey: ['renderEmail', bookingId, selectedTemplateId, invoiceId],
    queryFn: () =>
      apiGet<RenderResult>(
        `/bookings/${bookingId}/communications/render?templateId=${selectedTemplateId}${invoiceId ? `&invoiceId=${invoiceId}` : ''}`,
      ),
    enabled: isLoaded && open && !!selectedTemplateId,
    staleTime: 0,
  });

  useEffect(() => {
    if (renderResult) {
      setSubject(renderResult.subject);
      setMissingVariables(renderResult.missingVariables);
      editor?.commands.setContent(renderResult.body);
    }
  }, [renderResult]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMutation = useMutation({
    mutationFn: () => {
      const body = editor?.getHTML() ?? '';
      return apiPostVoid(`/bookings/${bookingId}/communications/send`, {
        to: booking.customer.email,
        contactId: booking.customerId,
        subject,
        body,
        ...(selectedTemplateId ? { templateId: selectedTemplateId } : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingCommunications', bookingId] });
      onOpenChange(false);
      toast({ title: 'Email sent' });
    },
    onError: () => {
      setSendError('Failed to send email. Check your internet connection and try again.');
    },
  });

  const noEmail = !booking.customer.email;
  const canSend = !noEmail && !!selectedTemplateId && !!subject && !rendering && !sendMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col w-full sm:max-w-lg p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <SheetTitle>Compose email</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Recipient */}
          <div>
            <p className="text-xs text-muted mb-1">To</p>
            {noEmail ? (
              <p className="text-sm text-status-cancelled">
                No email on file for {booking.customer.name} — add one before sending.
              </p>
            ) : (
              <p className="text-sm text-foreground">
                {booking.customer.name}
                <span className="text-muted ml-1">({booking.customer.email})</span>
              </p>
            )}
          </div>

          {/* Template picker */}
          <div>
            <p className="text-xs text-muted mb-1">Template</p>
            <Select
              value={selectedTemplateId}
              onValueChange={setSelectedTemplateId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {emailTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.builtInType ? TEMPLATE_DISPLAY[t.builtInType].name : t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Missing variables warning */}
          {missingVariables.length > 0 && (
            <div className="flex gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-800">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <span>
                <strong>{formatMissingVariables(missingVariables)}</strong>{' '}
                {missingVariables.length === 1 ? 'is' : 'are'} missing from this email.
                Update the booking before sending.
              </span>
            </div>
          )}

          {/* Subject */}
          {selectedTemplateId && (
            <div>
              <p className="text-xs text-muted mb-1">Subject</p>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={rendering}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
            </div>
          )}

          {/* Body editor */}
          {selectedTemplateId && (
            <div>
              <p className="text-xs text-muted mb-1">Body</p>
              <div className={`rounded-md border border-border bg-background px-3 py-2 tiptap-content ${rendering ? 'opacity-50' : ''}`}>
                {rendering ? (
                  <p className="text-sm text-muted min-h-48 flex items-center">Loading…</p>
                ) : (
                  <EditorContent editor={editor} />
                )}
              </div>
            </div>
          )}

          {/* Send error */}
          {sendError && (
            <p className="text-sm text-status-cancelled">{sendError}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sendMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={!canSend}
          >
            {sendMutation.isPending ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
