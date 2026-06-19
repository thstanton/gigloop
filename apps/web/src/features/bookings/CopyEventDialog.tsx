import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { FormField } from '@/components/common/FormField';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';

export interface CopyEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the chosen date (YYYY-MM-DD) when the musician confirms the copy. */
  onCopy: (date: string) => void;
  isPending: boolean;
  error?: string | null;
}

/**
 * Confirmation dialog for Copy Event (#507 / ADR-0049). Asks only for the new date and
 * telegraphs what carries vs. resets — acceptance is implicit, so the note is required,
 * not decoration. Presentational only: the mutation + navigation live in the container.
 */
export function CopyEventDialog({ open, onOpenChange, onCopy, isPending, error }: CopyEventDialogProps) {
  const [date, setDate] = useState('');

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Copy this event</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <ResponsiveDialogDescription className="pt-1">
          Sets up the same gig again on a new date, in the same series.
        </ResponsiveDialogDescription>

        <div className="space-y-4 pt-3">
          <FormField label="New date">
            <DatePicker value={date} onChange={setDate} placeholder="Pick a date" />
          </FormField>

          <div className="rounded-md border border-border p-3 text-sm text-muted space-y-2">
            <p>
              <span className="text-foreground font-medium">Carries over:</span> customer, venue,
              agent, event type, title, fee, notes, packages &amp; sets, logistics and the music form.
            </p>
            <p>
              <span className="text-foreground font-medium">Starts fresh:</span> a new Confirmed
              booking with its own portal link — no invoices, contracts, emails, deposit or completed
              checklist items carry across.
            </p>
          </div>

          {error && <p className="text-sm text-status-cancelled">{error}</p>}

          <div className="flex gap-3">
            <Button onClick={() => onCopy(date)} disabled={!date || isPending}>
              {isPending ? 'Copying…' : 'Copy event'}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
