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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { STATUS_ORDER } from '@/lib/constants';
import type { BookingStatus, ChecklistItem } from '@/types/api';

const STATUS_PILL_CLASSES: Record<BookingStatus, string> = {
  ENQUIRY:      'bg-status-enquiry/12 text-status-enquiry border-l-status-enquiry',
  PROVISIONAL:  'bg-status-provisional/12 text-status-provisional border-l-status-provisional',
  CONFIRMED:    'bg-status-confirmed/12 text-status-confirmed border-l-status-confirmed',
  READY:        'bg-status-ready/12 text-status-ready border-l-status-ready',
  COMPLETE:     'bg-status-complete/12 text-status-complete border-l-status-complete',
  CANCELLED:    'bg-status-cancelled/12 text-status-cancelled border-l-status-cancelled',
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  ENQUIRY:      'Enquiry',
  PROVISIONAL:  'Provisional',
  CONFIRMED:    'Confirmed',
  READY:        'Ready',
  COMPLETE:     'Complete',
  CANCELLED:    'Cancelled',
};

interface OutstandingChecklistDialogProps {
  pendingStatus: BookingStatus;
  outstandingItems: ChecklistItem[];
  onConfirm: () => void;
  onCancel: () => void;
}

function OutstandingChecklistDialog({ pendingStatus, outstandingItems, onConfirm, onCancel }: Readonly<OutstandingChecklistDialogProps>) {
  const label = STATUS_LABELS[pendingStatus];
  const count = outstandingItems.length;
  const plural = count === 1 ? '' : 's';

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Outstanding checklist items</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          {count} item{plural} still outstanding for{' '}
          <span className="font-medium text-foreground">{label}</span>:
        </DialogDescription>
        <ul className="text-sm space-y-1 list-disc list-inside text-foreground">
          {outstandingItems.map((item) => (
            <li key={item.id}>{item.label}</li>
          ))}
        </ul>
        <p className="text-sm text-muted">Mark as {label} anyway?</p>
        <div className="flex gap-2 justify-end mt-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onConfirm}>Mark as {label}</Button>
        </div>
      </DialogContent>
    </Dialog>
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
              STATUS_PILL_CLASSES[displayStatus],
              isPending && 'opacity-50',
            )}
          >
            {STATUS_LABELS[displayStatus]}
            <ChevronDown size={10} className="opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {STATUS_ORDER.map((s) => (
            <DropdownMenuItem key={s} onSelect={() => handleSelect(s)} className="gap-2">
              <span className={cn('inline-flex items-center border-l-[3px] pl-2 pr-2.5 py-0.5 text-xs font-medium', STATUS_PILL_CLASSES[s])}>
                {STATUS_LABELS[s]}
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
