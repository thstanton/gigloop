import { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link_ from '@tiptap/extension-link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { apiGet, apiPostVoid } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { TEMPLATE_DISPLAY } from '@/features/templates/templateMeta';
import {
  bandClipboardFallback,
  bandMessagePreview,
  canCopyBandMessage,
  canSendBandEmail,
  composeTemplateLabel,
  missingBandDetailsNotice,
} from './bandCommunicationComposeParts';
import { useBandInviteCopyActions } from './useBandInviteCopyActions';
import type {
  BandInviteMessageRenderResult,
  BandInviteRenderResult,
  BookingBandMember,
  SendBandInviteInput,
  Template,
} from '@/types/api';

interface Props {
  bookingId: string;
  member: BookingBandMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function BandInviteComposeSheetBody({ bookingId, member, onOpenChange }: Omit<Props, 'open'>) {
  const { isLoaded } = useAuth();
  const [subject, setSubject] = useState('');
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false, underline: false }),
      Underline,
      Link_.configure({ openOnClick: false }),
    ],
    content: '',
    editorProps: { attributes: { class: 'min-h-40 focus:outline-none text-sm leading-relaxed' } },
  });

  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['templates'],
    queryFn: () => apiGet<Template[]>('/templates'),
    enabled: isLoaded,
  });
  const template = templates.find((item) => item.builtInType === 'band_invite') ?? null;
  const messageTemplate = templates.find((item) => item.builtInType === 'band_invite_message') ?? null;
  const renderUrl = template
    ? `/bookings/${bookingId}/band-members/${member.id}/invite/render?templateId=${encodeURIComponent(template.id)}`
    : '';
  const messageRenderUrl = messageTemplate
    ? `/bookings/${bookingId}/band-members/${member.id}/invite/message/render?templateId=${encodeURIComponent(messageTemplate.id)}`
    : '';
  const renderQuery = useQuery({
    queryKey: ['bandInviteRender', bookingId, member.id, template?.id],
    queryFn: () => apiGet<BandInviteRenderResult>(renderUrl),
    enabled: isLoaded && !!renderUrl,
    staleTime: 0,
  });
  const messageRenderQuery = useQuery({
    queryKey: ['bandInviteMessageRender', bookingId, member.id, messageTemplate?.id],
    queryFn: () => apiGet<BandInviteMessageRenderResult>(messageRenderUrl),
    enabled: isLoaded && !!messageRenderUrl,
    staleTime: 0,
  });

  useEffect(() => {
    if (!renderQuery.data) return;
    setSubject(renderQuery.data.subject);
    editor?.commands.setContent(renderQuery.data.body);
  }, [renderQuery.data, editor]);

  const noEmail = !member.contact.email;
  const {
    clipboardFallbackText,
    clipboardFallbackRef,
    copyMutation,
    invalidateInvitationQueries,
    markSentMutation,
  } = useBandInviteCopyActions({ bookingId, member, messageTemplate, onOpenChange });

  const sendMutation = useMutation({
    mutationFn: () => {
      if (!template) throw new Error('Band invitation template is unavailable');
      const input: SendBandInviteInput = {
        templateId: template.id,
        subject,
        body: editor?.getHTML() ?? '',
      };
      return apiPostVoid(`/bookings/${bookingId}/band-members/${member.id}/invite/send`, input);
    },
    onSuccess: () => {
      invalidateInvitationQueries();
      toast({ title: 'Invitation sent' });
      onOpenChange(false);
    },
    onError: () => toast({ title: 'Failed to send invitation. Please try again.', variant: 'destructive' }),
  });

  const canSend = canSendBandEmail({
    recipientReady: !noEmail,
    templateReady: !!template,
    contentValid: !!subject.trim(),
    rendered: !!renderQuery.data,
    templatesIdle: !loadingTemplates,
    renderIdle: !renderQuery.isFetching,
    emailIdle: !sendMutation.isPending,
    manualActionIdle: !markSentMutation.isPending,
  });
  const canCopy = canCopyBandMessage({
    templateReady: !!messageTemplate,
    rendered: !!messageRenderQuery.data,
    templatesIdle: !loadingTemplates,
    copyIdle: !copyMutation.isPending,
    markSentIdle: !markSentMutation.isPending,
    emailIdle: !sendMutation.isPending,
  });
  const templateLabel = composeTemplateLabel(
    loadingTemplates,
    template?.builtInType ? TEMPLATE_DISPLAY[template.builtInType].name : undefined,
    'Invitation template unavailable',
  );
  const messagePreview = bandMessagePreview({
    isFetching: messageRenderQuery.isFetching,
    body: messageRenderQuery.data?.body,
    isError: messageRenderQuery.isError,
    errorMessage: 'Could not load the copy-paste invitation. Please try again.',
    unavailableMessage: 'Invitation message template unavailable.',
  });

  return (
    <>
      <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
        <SheetTitle>Compose invitation</SheetTitle>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <div>
          <p className="text-xs text-muted mb-1">To</p>
          {member.contact.email ? (
            <p className="text-sm text-foreground">
              {member.contact.name}<span className="text-muted ml-1">({member.contact.email})</span>
            </p>
          ) : (
            <p className="text-base text-status-cancelled" role="status">
              No email address on file for {member.contact.name}. Add one to send by email.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
          <Paperclip size={14} className="flex-shrink-0 text-muted" />
          <span>Email includes calendar invitation</span>
        </div>

        {renderQuery.data?.missingVariables.length
          ? missingBandDetailsNotice('Some invitation details are missing from this booking. Review the message before sending.')
          : null}

        {renderQuery.isError && (
          <p className="text-sm text-status-cancelled">Could not load the invitation template. Please try again.</p>
        )}

        <div>
          <p className="text-xs text-muted mb-1">Template</p>
          <p className="text-sm text-foreground">{templateLabel}</p>
        </div>

        <div>
          <label htmlFor="band-invite-subject" className="text-xs text-muted mb-1 block">Subject</label>
          <input
            id="band-invite-subject"
            type="text"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            disabled={!renderQuery.data}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <p className="text-xs text-muted mb-1">Body</p>
          <div className="rounded-md border border-border bg-background px-3 py-2 tiptap-content">
            {renderQuery.isFetching ? (
              <div className="min-h-40 animate-pulse rounded bg-accent" />
            ) : (
              <EditorContent editor={editor} />
            )}
          </div>
        </div>

        <div>
          <p className="text-xs text-muted mb-1">Copy-paste message</p>
          {messagePreview}
        </div>

        {clipboardFallbackText !== null && bandClipboardFallback({
          text: clipboardFallbackText,
          id: 'band-invite-message-fallback',
          ariaLabel: 'Invitation message to copy manually',
          ref: clipboardFallbackRef,
          isSaving: markSentMutation.isPending,
          onSelect: () => {
            clipboardFallbackRef.current?.focus();
            clipboardFallbackRef.current?.select();
          },
          onMarkSent: () => markSentMutation.mutate(clipboardFallbackText),
        })}
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

export function BandInviteComposeSheet({ open, onOpenChange, ...rest }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col w-full sm:max-w-lg p-0">
        {open && <BandInviteComposeSheetBody {...rest} onOpenChange={onOpenChange} />}
      </SheetContent>
    </Sheet>
  );
}
