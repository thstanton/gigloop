import { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Lock,
  Plus,
  Sparkles,
} from 'lucide-react';
import { GhostButton } from '@/components/common/GhostButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

interface ChecklistItemShortcut {
  shortcutTemplateType?: string;
  shortcutAction?: ChecklistAction;
  shortcutMarkDone?: MarkDoneKey;
}

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
  shortcuts: ChecklistItemShortcut;
  isFailed: boolean;
  isPlayTheGig: boolean;
  isActionPending: boolean;
  itemId: string;
  onToggle: (itemId: string, newState: 'COMPLETE' | 'PENDING') => void;
  onOpenCompose: (templateType?: string) => void;
  onChecklistAction: (action: ChecklistAction) => void;
  onMarkDone: (key: MarkDoneKey) => void;
}

function ChecklistItemShortcuts({ shortcuts, isFailed, isPlayTheGig, isActionPending, itemId, onToggle, onOpenCompose, onChecklistAction, onMarkDone }: ChecklistItemShortcutsProps) {
  const label = isFailed ? 'Retry' : undefined;
  if (shortcuts.shortcutTemplateType) {
    return <button onClick={() => onOpenCompose(shortcuts.shortcutTemplateType)} className="text-xs text-primary hover:underline">{label ?? 'Send'}</button>;
  }
  if (shortcuts.shortcutAction) {
    return <button onClick={() => onChecklistAction(shortcuts.shortcutAction!)} className="text-xs text-primary hover:underline">{label ?? 'Create'}</button>;
  }
  if (shortcuts.shortcutMarkDone) {
    return <button onClick={() => onMarkDone(shortcuts.shortcutMarkDone!)} disabled={isActionPending} className="text-xs text-primary hover:underline disabled:opacity-50">{label ?? 'Mark done'}</button>;
  }
  if (!isPlayTheGig) {
    return <button onClick={() => onToggle(itemId, 'COMPLETE')} className="text-xs text-primary hover:underline">Mark done</button>;
  }
  return null;
}

interface ChecklistItemRowProps {
  item: ChecklistItem;
  shortcuts: ChecklistItemShortcut;
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

function ChecklistItemRow({ item, shortcuts, isActionPending, onToggle, onOpenCompose, onChecklistAction, onMarkDone }: Readonly<ChecklistItemRowProps>) {
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
            shortcuts={shortcuts}
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
  onSave: (data: { label: string; requiredForStatus: string | null; dueDate: string | null }) => void;
  isSaving: boolean;
  onDone: () => void;
}

function AddChecklistItemForm({ onSave, isSaving, onDone }: AddChecklistItemFormProps) {
  const [label, setLabel] = useState('');
  const [stage, setStage] = useState('NONE');
  const [dueDate, setDueDate] = useState('');

  return (
    <div className="mb-4 p-3 bg-surface border border-border rounded-md space-y-2.5">
      <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Item label" className="text-sm" autoFocus />
      <div className="space-y-1">
        <Select value={stage} onValueChange={setStage}>
          <SelectTrigger className="text-sm h-8 w-full">
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
      <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="text-sm h-8" />
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
  contractTemplateType: string;
  onToggle: (itemId: string, newState: 'COMPLETE' | 'PENDING') => void;
  onChecklistAction: (action: ChecklistAction) => void;
  onOpenCompose: (templateType?: string) => void;
  onMarkDone: (key: MarkDoneKey) => void;
  onAddItem: (data: { label: string; requiredForStatus: string | null; dueDate: string | null }) => void;
  isAddingItem?: boolean;
  isActionPending?: boolean;
}

export default function ChecklistSection({
  items,
  isLoading,
  bookingStatus,
  contractTemplateType,
  onToggle,
  onChecklistAction,
  onOpenCompose,
  onMarkDone,
  onAddItem,
  isAddingItem = false,
  isActionPending = false,
}: ChecklistSectionProps) {
  const [showAllChecklist, setShowAllChecklist] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);

  const CHECKLIST_SHORTCUTS: Record<string, ChecklistItemShortcut> = {
    send_quote: { shortcutTemplateType: 'quote' },
    create_contract: { shortcutAction: 'create_contract' },
    create_deposit_invoice: { shortcutAction: 'create_deposit_invoice' },
    send_contract: { shortcutTemplateType: contractTemplateType },
    contract_signed: { shortcutMarkDone: 'mark_contract_signed' },
    deposit_received: { shortcutMarkDone: 'mark_deposit_received' },
    create_balance_invoice: { shortcutAction: 'create_balance_invoice' },
    music_form_invite: { shortcutTemplateType: 'music_form_invite' },
    send_thank_you: { shortcutTemplateType: 'thank_you' },
  };

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

  const baseList = showAllChecklist ? items : items.filter((i) => i.state !== 'BLOCKED');
  if (baseList.length === 0 && !showAddItem) return null;

  const bookingIdx = STAGE_LIST.indexOf(bookingStatus as typeof STAGE_LIST[number]);
  const defaultStageSet = new Set<string | null>([null]);
  if (bookingIdx >= 0) defaultStageSet.add(STAGE_LIST[bookingIdx]);
  if (bookingIdx >= 0 && bookingIdx + 1 < STAGE_LIST.length) defaultStageSet.add(STAGE_LIST[bookingIdx + 1]);

  const filtered = showAllChecklist ? baseList : baseList.filter((i) => defaultStageSet.has(i.requiredForStatus));
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
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Checklist</h2>
        <GhostButton onClick={() => setShowAddItem((v) => !v)} variant="primary" size="xs" icon={<Plus size={12} />}>
          Add item
        </GhostButton>
      </div>

      {showAddItem && (
        <AddChecklistItemForm
          onSave={(data) => { onAddItem(data); setShowAddItem(false); }}
          isSaving={isAddingItem}
          onDone={() => setShowAddItem(false)}
        />
      )}

      {(itemsByStage.get(null) ?? []).map((item) => (
        <ChecklistItemRow key={item.id} item={item} shortcuts={item.key ? (CHECKLIST_SHORTCUTS[item.key] ?? {}) : {}} {...rowProps} />
      ))}

      {STAGE_DISPLAY_ORDER.map((stage) => {
        const stageItems = itemsByStage.get(stage) ?? [];
        if (!stageItems.length) return null;
        return (
          <div key={stage}>
            {stageItems.map((item) => (
              <ChecklistItemRow key={item.id} item={item} shortcuts={item.key ? (CHECKLIST_SHORTCUTS[item.key] ?? {}) : {}} {...rowProps} />
            ))}
            <div className="flex items-center gap-2 my-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] font-medium text-muted uppercase tracking-wider">{STAGE_LABELS[stage]}</span>
            </div>
          </div>
        );
      })}

      <div className="mt-1 space-y-1.5">
        {hiddenCount > 0 && !showAllChecklist && (
          <button onClick={() => setShowAllChecklist(true)} className="text-xs text-muted hover:text-foreground transition-colors">Show all</button>
        )}
        {showAllChecklist && items.length > 0 && (
          <button onClick={() => setShowAllChecklist(false)} className="text-xs text-muted hover:text-foreground transition-colors">Show fewer</button>
        )}
      </div>
    </section>
  );
}
