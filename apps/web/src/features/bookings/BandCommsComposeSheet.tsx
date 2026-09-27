import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link_ from '@tiptap/extension-link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { AlertTriangle, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { apiGet, apiPostVoid } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { TEMPLATE_DISPLAY } from '@/features/templates/templateMeta';
import { useBandCommsCopyActions } from './useBandCommsCopyActions';
import { BAND_COMMUNICATION_META, type BandCommunicationKind } from './bandCommunicationMeta';
import type {
  BandCommunicationMessageRenderResult,
  BandCommunicationRenderResult,
  BookingBandMember,
  SendBandCommunicationInput,
  Template,
} from '@/types/api';

interface Props {
  bookingId: string;
  member: BookingBandMember;
  kind: BandCommunicationKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const composeSchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required'),
  bodyText: z.string().trim().min(1, 'Message body is required'),
});

type ComposeValues = z.infer<typeof composeSchema>;

function BandCommsComposeSheetBody({ bookingId, member, kind, onOpenChange }: Omit<Props, 'open'>) {
  const { isLoaded } = useAuth();
  const queryClient = useQueryClient();
  const {
    register,
    setValue,
    getValues,
    watch,
    formState: { errors, isValid },
  } = useForm<ComposeValues>({
    resolver: zodResolver(composeSchema),
    mode: 'onChange',
    defaultValues: { subject: '', bodyText: '' },
  });
  const subject = watch('subject');
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false, underline: false }),
      Underline,
      Link_.configure({ openOnClick: false }),
    ],
    content: '',
    editorProps: { attributes: { class: 'min-h-40 focus:outline-none text-base leading-relaxed' } },
    onUpdate: ({ editor: changedEditor }) => {
      setValue('bodyText', changedEditor.getText(), { shouldDirty: true, shouldValidate: true });
    },
  });

  const communication = BAND_COMMUNICATION_META[kind];
  const label = communication.label;
  const endpoint = `/bookings/${bookingId}/band-members/${member.id}/${kind}`;
  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['templates'],
    queryFn: () => apiGet<Template[]>('/templates'),
    enabled: isLoaded,
  });
  const template = templates.find((item) => item.builtInType === communication.emailTemplateType) ?? null;
  const messageTemplate = templates.find((item) => item.builtInType === communication.messageTemplateType) ?? null;
  const renderUrl = template ? `${endpoint}/render?templateId=${encodeURIComponent(template.id)}` : '';
  const messageRenderUrl = messageTemplate
    ? `${endpoint}/message/render?templateId=${encodeURIComponent(messageTemplate.id)}`
    : '';
  const renderQuery = useQuery({
    queryKey: ['bandCommunicationRender', bookingId, member.id, kind, template?.id],
    queryFn: () => apiGet<BandCommunicationRenderResult>(renderUrl),
    enabled: isLoaded && !!renderUrl,
    staleTime: 0,
  });
  const messageRenderQuery = useQuery({
    queryKey: ['bandCommunicationMessageRender', bookingId, member.id, kind, messageTemplate?.id],
    queryFn: () => apiGet<BandCommunicationMessageRenderResult>(messageRenderUrl),
    enabled: isLoaded && !!messageRenderUrl,
    staleTime: 0,
  });

  useEffect(() => {
    if (!renderQuery.data) return;
    setValue('subject', renderQuery.data.subject, { shouldValidate: true });
    editor?.commands.setContent(renderQuery.data.body);
    setValue('bodyText', editor?.getText() ?? '', { shouldValidate: true });
  }, [renderQuery.data, editor, setValue]);

  const noEmail = !member.contact.email;
  const { clipboardFallbackText, clipboardFallbackRef, copyMutation, markSentMutation } = useBandCommsCopyActions({
    bookingId,
    member,
    kind,
    messageTemplate,
    onOpenChange,
  });
  const sendMutation = useMutation({
    mutationFn: () => {
      if (!template) throw new Error(`Band ${label} template is unavailable`);
      const input: SendBandCommunicationInput = {
        templateId: template.id,
        subject: getValues('subject'),
        body: editor?.getHTML() ?? '',
      };
      return apiPostVoid(`${endpoint}/send`, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['bookingCommunications', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookingChecklist', bookingId] });
      if (kind === 'call-sheet') queryClient.invalidateQueries({ queryKey: ['bookingDocuments', bookingId] });
      toast({ title: `${communication.title} sent` });
      onOpenChange(false);
    },
    onError: () => toast({ title: `Failed to send ${label}. Please try again.`, variant: 'destructive' }),
  });

  const canSend =
    !noEmail && !!template && isValid && !!renderQuery.data && !loadingTemplates &&
    !renderQuery.isFetching && !sendMutation.isPending && !markSentMutation.isPending;
  const canCopy =
    !!messageTemplate && !!messageRenderQuery.data && !loadingTemplates && !copyMutation.isPending &&
    !markSentMutation.isPending && !sendMutation.isPending;
  let templateLabel = `${label} template unavailable`;
  if (loadingTemplates) templateLabel = 'Loading…';
  else if (template?.builtInType) templateLabel = TEMPLATE_DISPLAY[template.builtInType].name;

  let messagePreview: ReactNode;
  if (messageRenderQuery.isFetching) {
    messagePreview = <div className="min-h-16 animate-pulse rounded bg-accent" />;
  } else if (messageRenderQuery.data) {
    messagePreview = (
      <pre className="whitespace-pre-wrap break-words rounded-md border border-border bg-background px-3 py-2 text-base font-sans">
        {messageRenderQuery.data.body}
      </pre>
    );
  } else if (messageRenderQuery.isError) {
    messagePreview = <p className="text-base text-status-cancelled" role="alert">Could not load the {label} message. Please try again.</p>;
  } else {
    messagePreview = <p className="text-base text-muted">{label} message template unavailable.</p>;
  }

  return (
    <>
      <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
        <SheetTitle>Compose {label}</SheetTitle>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <div>
          <p className="text-xs text-muted mb-1">To</p>
          {member.contact.email ? (
            <p className="text-base text-foreground">
              {member.contact.name}<span className="text-muted ml-1">({member.contact.email})</span>
            </p>
          ) : (
            <p className="text-base text-status-cancelled" role="status">
              No email address on file for {member.contact.name}. Add one to send by email.
            </p>
          )}
        </div>

        {communication.attachmentLabel && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-base">
            <Paperclip size={14} className="flex-shrink-0 text-muted" />
            <span>{communication.attachmentLabel}</span>
          </div>
        )}

        {renderQuery.data?.missingVariables.length ? (
          <div className="flex gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2.5 text-base text-amber-800">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <span>Some {label} details are missing from this booking. Review the message before sending.</span>
          </div>
        ) : null}

        {renderQuery.isError && (
          <p className="text-base text-status-cancelled">Could not load the {label} template. Please try again.</p>
        )}

        <div>
          <p className="text-xs text-muted mb-1">Template</p>
          <p className="text-base text-foreground">{templateLabel}</p>
        </div>

        <div>
          <label htmlFor="band-communication-subject" className="text-xs text-muted mb-1 block">Subject</label>
          <Input
            {...register('subject')}
            id="band-communication-subject"
            type="text"
            value={subject}
            onChange={(event) => setValue('subject', event.target.value, { shouldDirty: true, shouldValidate: true })}
            disabled={!renderQuery.data}
          />
          {errors.subject && <p className="text-sm text-status-cancelled" role="alert">{errors.subject.message}</p>}
        </div>

        <div>
          <p className="text-xs text-muted mb-1">Body</p>
          <div className="rounded-md border border-border bg-background px-3 py-2 tiptap-content">
            {renderQuery.isFetching ? <div className="min-h-40 animate-pulse rounded bg-accent" /> : <EditorContent editor={editor} />}
          </div>
          {errors.bodyText && <p className="text-sm text-status-cancelled" role="alert">{errors.bodyText.message}</p>}
        </div>

        <div>
          <p className="text-xs text-muted mb-1">Copy-paste message</p>
          {messagePreview}
        </div>

        {clipboardFallbackText !== null && (
          <div className="space-y-2" role="alert">
            <label htmlFor="band-communication-message-fallback" className="text-base text-status-cancelled">
              Select and copy this message manually:
            </label>
            <textarea
              ref={clipboardFallbackRef}
              id="band-communication-message-fallback"
              aria-label={`${kind === 'call-sheet' ? 'Call sheet' : 'Final details'} message to copy manually`}
              readOnly
              rows={4}
              value={clipboardFallbackText}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-base"
            />
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => {
                clipboardFallbackRef.current?.focus();
                clipboardFallbackRef.current?.select();
              }}>
                Select message
              </Button>
              <Button variant="outline" onClick={() => markSentMutation.mutate(clipboardFallbackText)} disabled={markSentMutation.isPending}>
                {markSentMutation.isPending ? 'Saving…' : 'Mark as sent'}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-border flex flex-col gap-3 sm:flex-row">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sendMutation.isPending || markSentMutation.isPending}>
          Cancel
        </Button>
        <div className="flex gap-3 sm:ml-auto">
          <Button variant="outline" className="flex-1 sm:flex-initial" onClick={() => copyMutation.mutate(messageRenderQuery.data?.body ?? '')} disabled={!canCopy}>
            {copyMutation.isPending ? 'Copying…' : 'Copy message'}
          </Button>
          <Button variant="outline" className="flex-1 sm:flex-initial" onClick={() => sendMutation.mutate()} disabled={!canSend}>
            {sendMutation.isPending ? 'Sending…' : 'Send email'}
          </Button>
        </div>
      </div>
    </>
  );
}

export function BandCommsComposeSheet({ open, onOpenChange, ...rest }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col w-full sm:max-w-lg p-0">
        {open && <BandCommsComposeSheetBody {...rest} onOpenChange={onOpenChange} />}
      </SheetContent>
    </Sheet>
  );
}
