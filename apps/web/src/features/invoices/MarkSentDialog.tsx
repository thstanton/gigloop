import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { apiPost } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import type { Invoice, UserProfile } from '@/types/api';

interface Props {
  bookingId: string;
  invoice: Invoice;
  userProfile: UserProfile | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MarkSentDialog({
  bookingId,
  invoice,
  userProfile,
  open,
  onOpenChange,
}: Props) {
  const queryClient = useQueryClient();
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (!open) return;
    const today = new Date().toISOString().slice(0, 10);
    setIssueDate(today);
    const terms = userProfile?.defaultPaymentTermsDays;
    if (terms) {
      const due = new Date();
      due.setDate(due.getDate() + terms);
      setDueDate(due.toISOString().slice(0, 10));
    } else {
      setDueDate('');
    }
  }, [open, userProfile?.defaultPaymentTermsDays]);

  const mutation = useMutation({
    mutationFn: () =>
      apiPost<Invoice>(`/bookings/${bookingId}/invoices/${invoice.id}/mark-sent`, {
        issueDate,
        dueDate: dueDate || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingInvoices', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookingChecklist', bookingId] });
      onOpenChange(false);
      toast({ title: 'Invoice marked as sent' });
    },
    onError: () => {
      toast({ title: 'Failed to mark invoice as sent', variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Mark as sent</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Issue date</label>
            <DatePicker value={issueDate} onChange={setIssueDate} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Due date <span className="text-muted font-normal">(optional)</span>
            </label>
            <DatePicker value={dueDate} onChange={setDueDate} placeholder="No due date" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!issueDate || mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Mark as sent'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
