import { useEffect, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { cn } from '@/lib/utils';
import { BOOKING_STATUS_LABELS, STATUS_ORDER, STATUS_TOKENS } from '@/lib/constants';
import type { BookingStatus, ChecklistItem } from '@/types/api';

// The pill's three colour columns, joined. Derived from the one status table rather than
// re-listed here — this file previously kept its own copy of both classes and labels.
const pillClasses = (status: BookingStatus) => {
  const { tint, text, borderL } = STATUS_TOKENS[status];
  return cn(tint, text, borderL);
};

interface OutstandingChecklistDialogProps {
  pendingStatus: BookingStatus;
  outstandingItems: ChecklistItem[];
  onConfirm: () => void;
  onCancel: () => void;
}

function OutstandingChecklistDialog({ pendingStatus, outstandingItems, onConfirm, onCancel }: Readonly<OutstandingChecklistDialogProps>) {
  const label = BOOKING_STATUS_LABELS[pendingStatus];
  const count = outstandingItems.length;
  const plural = count === 1 ? '' : 's';

  return (
    <ResponsiveDialog open onOpenChange={onCancel}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Outstanding checklist items</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <ResponsiveDialogDescription>
          {count} item{plural} still outstanding for{' '}
          <span className="font-medium text-foreground">{label}</span>:
        </ResponsiveDialogDescription>
        <ul className="text-sm space-y-1 list-disc list-inside text-foreground mt-2">
          {outstandingItems.map((item) => (
            <li key={item.id}>{item.label}</li>
          ))}
        </ul>
        <p className="text-sm text-muted mt-3">Mark as {label} anyway?</p>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onConfirm}>Mark as {label}</Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export interface BookingStatusDropdownProps {
  currentStatus: BookingStatus;
  checklist: ChecklistItem[];
  onStatusChange: (status: BookingStatus) => void;
  isPending: boolean;
}

export default function BookingStatusDropdown({
  currentStatus,
  checklist,
  onStatusChange,
  isPending,
}: Readonly<BookingStatusDropdownProps>) {
  const [pendingStatus, setPendingStatus] = useState<BookingStatus | null>(null);
  const [displayStatus, setDisplayStatus] = useState<BookingStatus>(currentStatus);

  useEffect(() => { setDisplayStatus(currentStatus); }, [currentStatus]);

  const outstandingFor = (status: BookingStatus) =>
    checklist.filter(
      (item) => item.requiredForStatus === status && (item.state === 'PENDING' || item.state === 'FAILED'),
    );

  const handleSelect = (s: BookingStatus) => {
    if (s === currentStatus) return;
    const outstanding = outstandingFor(s);
    if (outstanding.length > 0) {
      setPendingStatus(s);
    } else {
      setDisplayStatus(s);
      onStatusChange(s);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              'inline-flex items-center gap-1 border-l-[3px] pl-2 pr-2.5 py-0.5 text-xs font-medium cursor-pointer transition-opacity',
              pillClasses(displayStatus),
              isPending && 'opacity-50',
            )}
          >
            {BOOKING_STATUS_LABELS[displayStatus]}
            <ChevronDown size={10} className="opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {STATUS_ORDER.map((s) => (
            <DropdownMenuItem key={s} onSelect={() => handleSelect(s)} className="gap-2">
              <span className={cn('inline-flex items-center border-l-[3px] pl-2 pr-2.5 py-0.5 text-xs font-medium', pillClasses(s))}>
                {BOOKING_STATUS_LABELS[s]}
              </span>
              {s === currentStatus && <Check size={12} className="ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {pendingStatus && (
        <OutstandingChecklistDialog
          pendingStatus={pendingStatus}
          outstandingItems={outstandingFor(pendingStatus)}
          onConfirm={() => {
            setDisplayStatus(pendingStatus);
            onStatusChange(pendingStatus);
            setPendingStatus(null);
          }}
          onCancel={() => setPendingStatus(null)}
        />
      )}
    </>
  );
}
