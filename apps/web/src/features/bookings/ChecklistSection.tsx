import { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Lock,
  Plus,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { GhostButton } from '@/components/common/GhostButton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { cn } from '@/lib/utils';
import type { BookingStatus, ChecklistItem, ChecklistItemState } from '@/types/api';

const STAGE_LABELS: Record<string, string> = {
  ENQUIRY: 'Enquiry',
  PROVISIONAL: 'Provisional',
  CONFIRMED: 'Confirmed',
  READY: 'Ready',
  COMPLETE: 'Complete',
};

const STAGE_LIST = ['ENQUIRY', 'PROVISIONAL', 'CONFIRMED', 'READY', 'COMPLETE'] as const;
const STAGE_DISPLAY_ORDER = ['PROVISIONAL', 'CONFIRMED', 'READY', 'COMPLETE'];

function dueDateDisplay(dueDate: string | null | undefined): { text: string; className: string } | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - now.getTime()) / 86400000);
  if (diffDays < 0) {
    const n = Math.abs(diffDays);
    return { text: n === 1 ? '1 day overdue' : `${n} days overdue`, className: 'text-status-cancelled' };
  }
  if (diffDays === 0) return { text: 'Due today', className: 'text-amber-600' };
  if (diffDays === 1) return { text: 'Due tomorrow', className: 'text-amber-600' };
  if (diffDays <= 7) return { text: `Due in ${diffDays} days`, className: 'text-amber-600' };
  return {
    text: `Due ${due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
    className: 'text-muted',
  };
}

type ChecklistAction = 'create_deposit_invoice' | 'create_balance_invoice' | 'create_contract';
type MarkDoneKey = 'mark_contract_signed' | 'mark_deposit_received';

interface ChecklistItemIconProps {
  state: ChecklistItemState;
  isPlayTheGig: boolean;
  itemId: string;
  onToggle: (itemId: string, newState: 'COMPLETE' | 'PENDING') => void;
}

function ChecklistItemIcon({ state, isPlayTheGig, itemId, onToggle }: Readonly<ChecklistItemIconProps>) {
  if (state === 'COMPLETE') {
    return (
      <button
        onClick={() => onToggle(itemId, 'PENDING')}
        className={cn('flex-shrink-0 transition-colors', isPlayTheGig ? 'text-status-ready hover:text-status-ready/70' : 'text-status-confirmed hover:text-status-confirmed/70')}
        aria-label="Mark as incomplete"
      >
        {isPlayTheGig ? <Sparkles size={16} /> : <CheckCircle2 size={16} />}
      </button>
    );
  }
  if (state === 'FAILED') {
    return (
      <button onClick={() => onToggle(itemId, 'PENDING')} className="flex-shrink-0 text-status-cancelled hover:text-status-cancelled/70 transition-colors" aria-label="Retry">
        <AlertTriangle size={16} />
      </button>
    );
  }
  if (state === 'BLOCKED') {
    return <Lock size={16} className="flex-shrink-0 text-muted" />;
  }
  return (
    <button
      onClick={() => {
        if (isPlayTheGig) confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        onToggle(itemId, 'COMPLETE');
      }}
      className={cn('flex-shrink-0 transition-colors', isPlayTheGig ? 'text-muted hover:text-status-ready' : 'text-muted hover:text-status-confirmed')}
      aria-label="Mark as complete"
    >
      {isPlayTheGig ? <Sparkles size={16} /> : <Circle size={16} />}
    </button>
  );
}

interface ChecklistItemShortcutsProps {
  shortcutType?: string;
  shortcutTemplateType?: string;
  isFailed: boolean;
  isPlayTheGig: boolean;
  isActionPending: boolean;
  itemId: string;
  onToggle: (itemId: string, newState: 'COMPLETE' | 'PENDING') => void;
  onOpenCompose: (templateType?: string) => void;
  onChecklistAction: (action: ChecklistAction) => void;
  onMarkDone: (key: MarkDoneKey) => void;
}

function ChecklistItemShortcuts({ shortcutType, shortcutTemplateType, isFailed, isPlayTheGig, isActionPending, itemId, onToggle, onOpenCompose, onChecklistAction, onMarkDone }: ChecklistItemShortcutsProps) {
  const label = isFailed ? 'Retry' : undefined;
  if (shortcutType === 'send_email') {
    return <button onClick={() => onOpenCompose(shortcutTemplateType)} className="text-xs text-primary hover:underline">{label ?? 'Send'}</button>;
  }
  if (shortcutType === 'create_contract' || shortcutType === 'create_deposit_invoice' || shortcutType === 'create_balance_invoice') {
    return <button onClick={() => onChecklistAction(shortcutType as ChecklistAction)} className="text-xs text-primary hover:underline">{label ?? 'Create'}</button>;
  }
  if (shortcutType === 'mark_contract_signed' || shortcutType === 'mark_deposit_received') {
    return <button onClick={() => onMarkDone(shortcutType as MarkDoneKey)} disabled={isActionPending} className="text-xs text-primary hover:underline disabled:opacity-50">{label ?? 'Mark done'}</button>;
  }
  if (!isPlayTheGig) {
    return <button onClick={() => onToggle(itemId, 'COMPLETE')} className="text-xs text-primary hover:underline">Mark done</button>;
  }
  return null;
}

interface ChecklistItemRowProps {
  item: ChecklistItem;
  isActionPending: boolean;
  onToggle: (itemId: string, newState: 'COMPLETE' | 'PENDING') => void;
  onOpenCompose: (templateType?: string) => void;
  onChecklistAction: (action: ChecklistAction) => void;
  onMarkDone: (key: MarkDoneKey) => void;
}

function labelClass(isDone: boolean, isFailed: boolean): string {
  if (isDone) return 'text-muted line-through';
  if (isFailed) return 'text-status-cancelled';
  return 'text-foreground';
}

function ChecklistItemRow({ item, isActionPending, onToggle, onOpenCompose, onChecklistAction, onMarkDone }: Readonly<ChecklistItemRowProps>) {
  const isDone = item.state === 'COMPLETE';
  const isFailed = item.state === 'FAILED';
  const isBlocked = item.state === 'BLOCKED';
  const isPlayTheGig = item.key === 'play_the_gig';
  const due = dueDateDisplay(item.dueDate);

  return (
    <div className={cn('flex items-center justify-between gap-2.5 py-1.5', isBlocked && 'opacity-40')}>
      <div className="flex items-center gap-2.5 min-w-0">
        <ChecklistItemIcon state={item.state} isPlayTheGig={isPlayTheGig} itemId={item.id} onToggle={onToggle} />
        <div className="min-w-0">
          <span className={cn('text-sm', labelClass(isDone, isFailed))}>
            {item.label}
          </span>
          {due && !isDone && !isBlocked && <p className={cn('text-xs', due.className)}>{due.text}</p>}
        </div>
      </div>
      {!isDone && !isBlocked && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <ChecklistItemShortcuts
            shortcutType={item.shortcutType}
            shortcutTemplateType={item.shortcutTemplateType}
            isFailed={isFailed}
            isPlayTheGig={isPlayTheGig}
            isActionPending={isActionPending}
            itemId={item.id}
            onToggle={onToggle}
            onOpenCompose={onOpenCompose}
            onChecklistAction={onChecklistAction}
            onMarkDone={onMarkDone}
          />
        </div>
      )}
    </div>
  );
}

interface AddChecklistItemFormProps {
  className?: string;
  compact?: boolean;
  onSave: (data: { label: string; requiredForStatus: string | null; dueDate: string | null }) => void;
  isSaving: boolean;
  onDone: () => void;
}

function AddChecklistItemForm({ onSave, isSaving, onDone, className, compact = true }: AddChecklistItemFormProps) {
  const [label, setLabel] = useState('');
  const [stage, setStage] = useState('NONE');
  const [dueDate, setDueDate] = useState('');

  return (
    <div className={cn("mb-4 p-3 bg-surface border border-border rounded-md space-y-2.5", className)}>
      <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Item label" className={compact ? 'text-sm' : ''} autoFocus />
      <div className="space-y-1">
        <Select value={stage} onValueChange={setStage}>
          <SelectTrigger className={compact ? 'text-sm h-8 w-full' : 'w-full'}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NONE">No stage requirement</SelectItem>
            <SelectItem value="PROVISIONAL">Required for Provisional</SelectItem>
            <SelectItem value="CONFIRMED">Required for Confirmed</SelectItem>
            <SelectItem value="READY">Required for Ready</SelectItem>
            <SelectItem value="COMPLETE">Required for Complete</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted">Must be complete before advancing to this stage</p>
      </div>
      <DatePicker value={dueDate} onChange={setDueDate} placeholder="Due date (optional)" className={compact ? 'h-8 text-sm' : ''} />
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => onSave({ label: label.trim(), requiredForStatus: stage === 'NONE' ? null : stage, dueDate: dueDate || null })}
          disabled={!label.trim() || isSaving}
        >
          {isSaving ? 'Adding…' : 'Add'}
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

export interface ChecklistSectionProps {
  items: ChecklistItem[];
  isLoading: boolean;
  bookingStatus: BookingStatus;
  onToggle: (itemId: string, newState: 'COMPLETE' | 'PENDING') => void;
  onChecklistAction: (action: ChecklistAction) => void;
  onOpenCompose: (templateType?: string) => void;
  onMarkDone: (key: MarkDoneKey) => void;
  onAddItem: (data: { label: string; requiredForStatus: string | null; dueDate: string | null }) => void;
  isAddingItem?: boolean;
  isActionPending?: boolean;
  hideHeader?: boolean;
}

export default function ChecklistSection({
  items,
  isLoading,
  bookingStatus,
  onToggle,
  onChecklistAction,
  onOpenCompose,
  onMarkDone,
  onAddItem,
  isAddingItem = false,
  isActionPending = false,
  hideHeader = false,
}: ChecklistSectionProps) {
  const [showAllChecklist, setShowAllChecklist] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);

  if (isLoading) {
    return (
      <section>
        <div className="h-4 w-20 bg-border rounded animate-pulse mb-3" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2.5 animate-pulse">
              <div className="w-4 h-4 bg-border rounded-full flex-shrink-0" />
              <div className="h-3 bg-border rounded flex-1" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  const baseList = items.filter((i) => i.state !== 'BLOCKED' || showAllChecklist);
  if (baseList.length === 0 && !showAddItem) return null;

  const bookingIdx = STAGE_LIST.indexOf(bookingStatus as typeof STAGE_LIST[number]);

  let filtered: ChecklistItem[];
  let hiddenCount = 0;

  if (hideHeader) {
    // Tab view: show everything from current stage onwards; hide only past stages
    const forwardSet = new Set<string | null>([null, ...STAGE_LIST.slice(bookingIdx >= 0 ? bookingIdx : 0)]);
    filtered = showAllChecklist ? baseList : baseList.filter((i) => forwardSet.has(i.requiredForStatus));
  } else {
    // Sidebar view: current + next stage only, with show-all toggle
    const defaultStageSet = new Set<string | null>([null]);
    if (bookingIdx >= 0) defaultStageSet.add(STAGE_LIST[bookingIdx]);
    if (bookingIdx >= 0 && bookingIdx + 1 < STAGE_LIST.length) defaultStageSet.add(STAGE_LIST[bookingIdx + 1]);
    filtered = showAllChecklist ? baseList : baseList.filter((i) => defaultStageSet.has(i.requiredForStatus));
  }
  const hiddenCount = baseList.length - filtered.length;

  const itemsByStage = new Map<string | null, ChecklistItem[]>();
  for (const item of filtered) {
    const k = item.requiredForStatus ?? null;
    if (!itemsByStage.has(k)) itemsByStage.set(k, []);
    itemsByStage.get(k)!.push(item);
  }

  const rowProps = { onToggle, onOpenCompose, onChecklistAction, onMarkDone, isActionPending };

  return (
    <section>
      {!hideHeader && (
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Checklist</h2>
          <GhostButton onClick={() => setShowAddItem((v) => !v)} variant="primary" size="xs" icon={<Plus size={12} />}>
            Add item
          </GhostButton>
        </div>
      )}

      {hideHeader && (
        <GhostButton
          onClick={() => setShowAllChecklist((v) => !v)}
          size="xs"
          icon={showAllChecklist ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          className="w-full justify-center mb-2"
        >
          {showAllChecklist ? 'Show fewer' : `Show all${hiddenCount > 0 ? ` (${hiddenCount} hidden)` : ''}`}
        </GhostButton>
      )}

      {hideHeader ? (
        <Sheet open={showAddItem} onOpenChange={setShowAddItem}>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>Add checklist item</SheetTitle>
            </SheetHeader>
            <AddChecklistItemForm
              className="bg-transparent border-0 p-0 rounded-none mb-0 mt-6"
              compact={false}
              onSave={(data) => { onAddItem(data); setShowAddItem(false); }}
              isSaving={isAddingItem}
              onDone={() => setShowAddItem(false)}
            />
          </SheetContent>
        </Sheet>
      ) : showAddItem && (
        <AddChecklistItemForm
          onSave={(data) => { onAddItem(data); setShowAddItem(false); }}
          isSaving={isAddingItem}
          onDone={() => setShowAddItem(false)}
        />
      )}

      {(itemsByStage.get(null) ?? []).map((item) => (
        <ChecklistItemRow key={item.id} item={item} {...rowProps} />
      ))}

      {STAGE_DISPLAY_ORDER.map((stage) => {
        const stageItems = itemsByStage.get(stage) ?? [];
        if (!stageItems.length) return null;
        return (
          <div key={stage}>
            {stageItems.map((item) => (
              <ChecklistItemRow key={item.id} item={item} {...rowProps} />
            ))}
            <div className="flex items-center gap-2 my-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] font-medium text-muted uppercase tracking-wider">{STAGE_LABELS[stage]}</span>
            </div>
          </div>
        );
      })}

      {!hideHeader && (
        <div className="mt-1 space-y-1.5">
          {hiddenCount > 0 && !showAllChecklist && (
            <button onClick={() => setShowAllChecklist(true)} className="text-xs text-muted hover:text-foreground transition-colors">Show all</button>
          )}
          {showAllChecklist && items.length > 0 && (
            <button onClick={() => setShowAllChecklist(false)} className="text-xs text-muted hover:text-foreground transition-colors">Show fewer</button>
          )}
        </div>
      )}

      {hideHeader && (
        <Button className="w-full mt-3" onClick={() => setShowAddItem((v) => !v)}>
          <Plus size={16} />
          Add item
        </Button>
      )}
    </section>
  );
}
