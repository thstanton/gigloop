import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPatch, apiPost } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import type { BookingBandMember, Template } from '@/types/api';

export function useBandInviteCopyActions({
  bookingId,
  member,
  messageTemplate,
  onOpenChange,
}: {
  bookingId: string;
  member: BookingBandMember;
  messageTemplate: Template | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [clipboardFallbackText, setClipboardFallbackText] = useState<string | null>(null);
  const clipboardFallbackRef = useRef<HTMLTextAreaElement>(null);
  const loggedMessageRef = useRef<string | null>(null);

  const invalidateInvitationQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
    queryClient.invalidateQueries({ queryKey: ['bookingCommunications', bookingId] });
    queryClient.invalidateQueries({ queryKey: ['bookingChecklist', bookingId] });
  };

  const markSentMutation = useMutation({
    mutationFn: async (body: string) => {
      if (!messageTemplate) throw new Error('Band invitation message template is unavailable');
      if (loggedMessageRef.current !== body) {
        await apiPost<unknown>(`/bookings/${bookingId}/communications`, {
          contactId: member.contactId,
          subject: messageTemplate.name,
          body,
          templateId: messageTemplate.id,
          channel: 'MANUAL',
        });
        loggedMessageRef.current = body;
      }
      await apiPatch<unknown>(`/bookings/${bookingId}/band-members/${member.id}`, { status: 'INVITED' });
    },
    onSuccess: () => {
      loggedMessageRef.current = null;
      invalidateInvitationQueries();
      toast({ title: 'Invitation marked as sent' });
      onOpenChange(false);
    },
    onError: () => toast({ title: 'Failed to mark the invitation as sent. Please try again.', variant: 'destructive' }),
  });

  const copyMutation = useMutation({
    mutationFn: async (body: string) => {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API is unavailable');
      await navigator.clipboard.writeText(body);
    },
    onSuccess: (_result, body) => {
      setClipboardFallbackText(null);
      toast({
        title: 'Invitation copied',
        description: 'Paste the message where this player will see it, then mark it as sent.',
        action: (
          <ToastAction altText="Mark as sent" onClick={() => markSentMutation.mutate(body)}>
            Mark as sent
          </ToastAction>
        ),
      });
      // The sheet is modal; close it so the global toast action is focusable and can receive the
      // second tap after the organiser has pasted the message elsewhere.
      onOpenChange(false);
    },
    onError: (_error, body) => {
      setClipboardFallbackText(body);
      toast({
        title: 'Could not copy the invitation. Select the message below and copy it manually.',
        variant: 'destructive',
      });
    },
  });

  return { clipboardFallbackText, clipboardFallbackRef, copyMutation, invalidateInvitationQueries, markSentMutation };
}
