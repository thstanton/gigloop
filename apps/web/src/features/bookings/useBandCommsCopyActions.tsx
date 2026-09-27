import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import type { BookingBandMember, Template } from '@/types/api';
import { BAND_COMMUNICATION_META, type BandCommunicationKind } from './bandCommunicationMeta';

export function useBandCommsCopyActions({
  bookingId,
  member,
  kind,
  messageTemplate,
  onOpenChange,
}: {
  bookingId: string;
  member: BookingBandMember;
  kind: BandCommunicationKind;
  messageTemplate: Template | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [clipboardFallbackText, setClipboardFallbackText] = useState<string | null>(null);
  const clipboardFallbackRef = useRef<HTMLTextAreaElement>(null);
  const communication = BAND_COMMUNICATION_META[kind];
  const label = communication.label;

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
    queryClient.invalidateQueries({ queryKey: ['bookingCommunications', bookingId] });
    queryClient.invalidateQueries({ queryKey: ['bookingChecklist', bookingId] });
  };

  const markSentMutation = useMutation({
    mutationFn: (body: string) => {
      if (!messageTemplate) throw new Error(`Band ${label} message template is unavailable`);
      return apiPost<unknown>(`/bookings/${bookingId}/communications`, {
        contactId: member.contactId,
        subject: messageTemplate.name,
        body,
        templateId: messageTemplate.id,
        channel: 'MANUAL',
      });
    },
    onSuccess: () => {
      invalidateQueries();
      toast({ title: `${communication.title} marked as sent` });
      onOpenChange(false);
    },
    onError: () => toast({ title: `Failed to mark the ${label} as sent. Please try again.`, variant: 'destructive' }),
  });

  const copyMutation = useMutation({
    mutationFn: async (body: string) => {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API is unavailable');
      await navigator.clipboard.writeText(body);
    },
    onSuccess: (_result, body) => {
      setClipboardFallbackText(null);
      toast({
        title: `${communication.title} copied`,
        description: 'Paste the message where this player will see it, then mark it as sent.',
        action: (
          <ToastAction altText="Mark as sent" onClick={() => markSentMutation.mutate(body)}>
            Mark as sent
          </ToastAction>
        ),
      });
      onOpenChange(false);
    },
    onError: (_error, body) => {
      setClipboardFallbackText(body);
      toast({ title: `Could not copy the ${label}. Select the message below and copy it manually.`, variant: 'destructive' });
    },
  });

  return { clipboardFallbackText, clipboardFallbackRef, copyMutation, markSentMutation };
}
