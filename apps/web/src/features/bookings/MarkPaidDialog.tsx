import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { FormField } from '@/components/common/FormField';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';

/** Local-time YYYY-MM-DD for today — the date field's prefill (ADR-0068: paidAt defaults to today). */
function todayYMD(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

export interface MarkPaidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Called with the date the payment was received (YYYY-MM-DD) and the optional payment
   * reference (empty string when none) when the musician confirms.
   */
  onConfirm: (paidAt: string, paymentReference: string) => void;
  isPending: boolean;
  /** Label of the invoice being marked paid, so the musician sees which one they're recording. */
  invoiceLabel?: string;
  /**
   * When correcting an already-recorded payment (TIM-46), the stored date (YYYY-MM-DD) and
   * reference to prefill. Omitted when recording a fresh payment — the date then defaults to today
   * and the reference is blank. Same dialog, one mental model: capture and correction share it.
   */
  initialPaidAt?: string;
  initialReference?: string;
}

/**
 * Records that an invoice was paid (ADR-0068 / TIM-45). Mark-paid is no longer a one-tap action
 * that silently stamps "now": this dialog captures **when** the payment was received (prefilled to
 * today, correctable) and an optional payment reference. `paidAt` thereby *means* the date received,
 * which is what the financial reporting reads — the visible date field says so implicitly.
 *
 * Presentational only: the mutation lives in the container (`useInvoiceActions`). It is the single
 * dialog behind all three mark-paid surfaces (invoice row, series invoice card, checklist CTA).
 */
export function MarkPaidDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
  invoiceLabel,
  initialPaidAt,
  initialReference,
}: MarkPaidDialogProps) {
  const [paidAt, setPaidAt] = useState(initialPaidAt ?? todayYMD());
  const [paymentReference, setPaymentReference] = useState(initialReference ?? '');

  // One dialog instance is reused across every invoice in a section, so re-seed on each open —
  // to the stored values when correcting, else today + a blank reference — otherwise a prior
  // invoice's values would leak in.
  useEffect(() => {
    if (open) {
      setPaidAt(initialPaidAt ?? todayYMD());
      setPaymentReference(initialReference ?? '');
    }
  }, [open, initialPaidAt, initialReference]);

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Record payment</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <ResponsiveDialogDescription className="pt-1">
          {invoiceLabel
            ? `When did the payment for ${invoiceLabel} arrive? This is the date your reporting uses.`
            : 'When did the payment arrive? This is the date your reporting uses.'}
        </ResponsiveDialogDescription>

        <div className="space-y-4 pt-3">
          <FormField label="Date received">
            <DatePicker value={paidAt} onChange={setPaidAt} placeholder="Pick a date" />
          </FormField>

          <FormField label="Payment reference" hint="Optional — e.g. a bank reference.">
            <Input
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="Optional"
            />
          </FormField>

          <div className="flex gap-3">
            <Button onClick={() => onConfirm(paidAt, paymentReference)} disabled={!paidAt || isPending}>
              {isPending ? 'Recording…' : 'Record payment'}
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
