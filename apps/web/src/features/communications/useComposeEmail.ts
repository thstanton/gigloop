import { useState, useEffect, useRef, useMemo } from 'react';
import { useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link_ from '@tiptap/extension-link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { apiGet, apiPostVoid } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import {
  getInvoiceIdForTemplate,
  getAttachmentState,
  isComposableEmailTemplate,
  findPreselectTemplateId,
  computeInvoiceDateDefaults,
  buildRenderUrl,
  buildSendRequest,
  canRenderEmail,
  canSendEmail,
  shouldSuggestCreatingContract,
  shouldSuggestCreatingDepositInvoice,
  type AttachmentState,
} from './composeHelpers';
import type { BookingDetail, ChecklistItem, Invoice, Template } from '@/types/api';

interface RenderResult {
  subject: string;
  body: string;
  missingVariables: string[];
}

interface UseComposeEmailArgs {
  bookingId: string;
  booking: BookingDetail;
  invoices: Invoice[];
  checklist: ChecklistItem[];
  defaultPaymentTermsDays: number | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTemplateType?: string;
  onAfterSend?: (templateType: string | null) => void;
}

export interface ComposeEmailViewModel {
  noEmail: boolean;
  emailTemplates: Template[];
  selectedTemplateId: string;
  setSelectedTemplateId: (id: string) => void;
  attachmentState: AttachmentState;
  showDateFields: boolean;
  formIssueDate: string;
  setFormIssueDate: (value: string) => void;
  formDueDate: string;
  setFormDueDate: (value: string) => void;
  missingVariables: string[];
  rendering: boolean;
  subject: string;
  setSubject: (value: string) => void;
  editor: Editor | null;
  sendError: string | null;
  musicInviteBlocked: boolean;
  // #757: cross-suggest the combined contract + deposit send when composing only one half.
  showCreateContractHint: boolean;
  showCreateDepositHint: boolean;
  canSend: boolean;
  sending: boolean;
  send: () => void;
}

/**
 * Owns all compose-sheet state, the template/render queries, and the send mutation.
 * Returns a flat view model so the sheet body stays a thin presentational orchestrator.
 */
export function useComposeEmail({
  bookingId,
  booking,
  invoices,
  checklist,
  defaultPaymentTermsDays,
  open,
  onOpenChange,
  initialTemplateType,
  onAfterSend,
}: UseComposeEmailArgs): ComposeEmailViewModel {
  const { isLoaded } = useAuth();
  const queryClient = useQueryClient();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [missingVariables, setMissingVariables] = useState<string[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [formIssueDate, setFormIssueDate] = useState('');
  const [formDueDate, setFormDueDate] = useState('');

  const editor = useEditor({
    extensions: [StarterKit, Underline, Link_.configure({ openOnClick: false })],
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

  const emailTemplates = useMemo(
    () => templates.filter((t) => isComposableEmailTemplate(t, booking.hasMusicFormConfig)),
    [templates, booking.hasMusicFormConfig],
  );

  // No reset effect needed: the sheet renders <ComposeEmailSheetBody> only while open
  // ({open && …}), so the body unmounts on close and remounts with fresh useState/editor
  // state on the next open.

  // Pre-select once when the filtered template list is ready
  const didPreselect = useRef(false);
  useEffect(() => {
    if (!open) {
      didPreselect.current = false;
      return;
    }
    // Wait until templates have loaded before marking preselect done, else we'd bail forever.
    if (didPreselect.current || !initialTemplateType || emailTemplates.length === 0) return;
    const match = findPreselectTemplateId(emailTemplates, initialTemplateType);
    if (match) setSelectedTemplateId(match);
    didPreselect.current = true;
  }, [open, initialTemplateType, emailTemplates]);

  const selectedTemplate = emailTemplates.find((t) => t.id === selectedTemplateId) ?? null;
  const selectedType = selectedTemplate?.builtInType ?? null;
  // #533/#631: block the send (not just the dropdown item) when the invite template is selected but
  // the form is not published — the API would 409. Covers a template pre-selected by a checklist
  // shortcut, or the form being un-published after the sheet opened.
  const musicInviteBlocked =
    selectedType === 'music_form_invite' && !(booking.portalVisibility.musicForm?.visible ?? false);
  const showCreateContractHint = shouldSuggestCreatingContract(selectedType, booking.activeContract, checklist);
  const showCreateDepositHint = shouldSuggestCreatingDepositInvoice(selectedType, invoices, checklist);
  const invoiceId = getInvoiceIdForTemplate(selectedType, invoices);
  const invoiceForSend = invoices.find((i) => i.id === invoiceId);
  const attachmentState = getAttachmentState(selectedType, invoices);
  // Route to invoice send endpoint for any non-void invoice template (ISSUED or DRAFT).
  const isInvoiceEmail = !!invoiceId;
  // Date fields are only needed for DRAFT invoices — ISSUED already have dates from issue time.
  const showDateFields = isInvoiceEmail && invoiceForSend?.status === 'DRAFT';

  // Seed date defaults when switching to an invoice template
  useEffect(() => {
    if (!showDateFields) return;
    const { issueDate, dueDate } = computeInvoiceDateDefaults(defaultPaymentTermsDays);
    setFormIssueDate(issueDate);
    setFormDueDate(dueDate);
  }, [showDateFields, defaultPaymentTermsDays]);

  const renderUrl = useMemo(
    () =>
      buildRenderUrl({
        bookingId,
        templateId: selectedTemplateId,
        invoiceId,
        issueDate: formIssueDate,
        dueDate: formDueDate,
        showDateFields,
      }),
    [bookingId, selectedTemplateId, invoiceId, formIssueDate, formDueDate, showDateFields],
  );

  const { data: renderResult, isFetching: rendering } = useQuery({
    queryKey: ['renderEmail', bookingId, selectedTemplateId, invoiceId, formIssueDate, formDueDate],
    queryFn: () => apiGet<RenderResult>(renderUrl),
    enabled: canRenderEmail({
      isLoaded,
      open,
      hasTemplate: !!selectedTemplate,
      renderUrl,
      showDateFields,
      formIssueDate,
    }),
    staleTime: 0,
  });

  // Seed the editable subject/body from each render result. `editor` is in the deps so that
  // if a render arrives before Tiptap has mounted, we still populate once the instance exists.
  useEffect(() => {
    if (renderResult) {
      setSubject(renderResult.subject);
      setMissingVariables(renderResult.missingVariables);
      editor?.commands.setContent(renderResult.body);
    }
  }, [renderResult, editor]);

  const sendMutation = useMutation({
    mutationFn: () => {
      const { url, payload } = buildSendRequest({
        bookingId,
        invoiceId,
        isInvoiceEmail,
        showDateFields,
        formIssueDate,
        formDueDate,
        to: booking.customer.email,
        contactId: booking.customerId,
        subject,
        body: editor?.getHTML() ?? '',
        templateId: selectedTemplateId,
      });
      return apiPostVoid(url, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingCommunications', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookingChecklist', bookingId] });
      if (isInvoiceEmail && invoiceId) {
        queryClient.invalidateQueries({ queryKey: ['bookingInvoices', bookingId] });
        queryClient.invalidateQueries({ queryKey: ['bookingDocuments', bookingId] });
      }
      onAfterSend?.(selectedType);
      onOpenChange(false);
      toast({ title: 'Email sent' });
    },
    onError: (err) => {
      // #631: the API rejects a music-form invite for an unpublished form with 409 — surface the
      // reason instead of the generic connectivity message.
      setSendError(
        err instanceof Response && err.status === 409
          ? 'Publish the music form before you can send its invite.'
          : 'Failed to send email. Check your internet connection and try again.',
      );
    },
  });

  const noEmail = !booking.customer.email;

  return {
    noEmail,
    emailTemplates,
    selectedTemplateId,
    setSelectedTemplateId,
    attachmentState,
    showDateFields,
    formIssueDate,
    setFormIssueDate,
    formDueDate,
    setFormDueDate,
    missingVariables,
    rendering,
    subject,
    setSubject,
    editor,
    sendError,
    musicInviteBlocked,
    showCreateContractHint,
    showCreateDepositHint,
    canSend: canSendEmail({
      hasEmail: !noEmail,
      hasTemplate: !!selectedTemplateId,
      hasSubject: !!subject,
      rendering,
      sending: sendMutation.isPending,
      showDateFields,
      formIssueDate,
      musicInviteBlocked,
    }),
    sending: sendMutation.isPending,
    send: () => sendMutation.mutate(),
  };
}
