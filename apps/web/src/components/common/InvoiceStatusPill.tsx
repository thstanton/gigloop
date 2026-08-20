import type { InvoiceStatus } from '@/types/api';
import { StatusPill } from '@/components/common/StatusPill';
import { INVOICE_OVERDUE_TOKENS, INVOICE_STATUS_LABELS, INVOICE_STATUS_TOKENS } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface InvoiceStatusPillProps {
  status: InvoiceStatus;
  isOverdue?: boolean;
  className?: string;
}

export default function InvoiceStatusPill({ status, isOverdue, className }: InvoiceStatusPillProps) {
  if (isOverdue) {
    const { label, tint, text, borderL } = INVOICE_OVERDUE_TOKENS;
    return <StatusPill label={label} bg={tint} text={text} border={borderL} className={cn(className)} />;
  }
  const { tint, text, borderL } = INVOICE_STATUS_TOKENS[status];
  return (
    <StatusPill
      label={INVOICE_STATUS_LABELS[status]}
      bg={tint}
      text={text}
      border={borderL}
      className={cn(className)}
    />
  );
}
