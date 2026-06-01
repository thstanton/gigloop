import { useState } from 'react';
import { CheckSquare, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/common/PageHeader';
import { SubLabel } from '@/components/common/SubLabel';
import type { BookingStatus, ChecklistDefaultItem } from '@/types/api';

const STAGE_LABELS: Record<string, string> = {
  PROVISIONAL: 'Provisional',
  CONFIRMED: 'Confirmed',
  READY: 'Ready',
  COMPLETE: 'Complete',
};

const STAGE_ORDER: Array<BookingStatus | null> = [
  null, 'ENQUIRY', 'PROVISIONAL', 'CONFIRMED', 'READY', 'COMPLETE',
];

const STATUS_TO_STAGE: Record<string, BookingStatus | null> = {
  ENQUIRY: null, PROVISIONAL: 'PROVISIONAL', CONFIRMED: 'CONFIRMED',
  READY: 'READY', COMPLETE: 'COMPLETE', CANCELLED: 'COMPLETE',
};

function filterByStartingStatus(
  items: ChecklistDefaultItem[],
  startingStatus: BookingStatus,
): ChecklistDefaultItem[] {
  const startStage = STATUS_TO_STAGE[startingStatus] ?? null;
  const startIdx = STAGE_ORDER.indexOf(startStage);
  return items.filter((item) => {
    if (item.requiredForStatus === null) return true;
    return STAGE_ORDER.indexOf(item.requiredForStatus) > startIdx;
  });
}

interface Props {
  defaults: ChecklistDefaultItem[];
  startingStatus: BookingStatus;
  onBack: () => void;
  onCreate: (items: ChecklistDefaultItem[]) => void;
  isCreating: boolean;
  isError: boolean;
}

export function ChecklistStep({ defaults, startingStatus, onBack, onCreate, isCreating, isError }: Props) {
  const filtered = filterByStartingStatus(defaults, startingStatus);

  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    () => new Set(filtered.map((_, i) => i).filter((i) => filtered[i].enabled !== false)),
  );
  const [customItems, setCustomItems] = useState<Array<{ label: string; stage: string }>>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newStage, setNewStage] = useState('CONFIRMED');

  const grouped = (['PROVISIONAL', 'CONFIRMED', 'READY', 'COMPLETE'] as const)
    .map((stage) => ({
      stage,
      entries: filtered
        .map((item, idx) => ({ item, idx }))
        .filter(({ item }) => item.requiredForStatus === stage),
    }))
    .filter(({ entries }) => entries.length > 0);

  function toggle(idx: number) {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function addCustomItem() {
    if (!newLabel.trim()) return;
    setCustomItems((prev) => [...prev, { label: newLabel.trim(), stage: newStage }]);
    setNewLabel('');
  }

  function handleCreate() {
    const selected = filtered.filter((_, i) => selectedIndices.has(i));
    const custom: ChecklistDefaultItem[] = customItems
      .filter((ci) => ci.label.trim())
      .map((ci) => ({
        key: null,
        label: ci.label.trim(),
        completedBy: 'USER' as const,
        dependsOn: [],
        autoCompleteRule: null,
        requiredForStatus: ci.stage as ChecklistDefaultItem['requiredForStatus'],
        dueDateRule: null,
      }));
    onCreate([...selected, ...custom]);
  }

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto">
      <PageHeader title="Checklist" onBack={onBack} backLabel="Back" />
      <p className="text-sm text-muted -mt-4 mb-6">
        Choose which items to include. You can adjust these on the booking page later.
      </p>

      {grouped.length > 0 ? (
        <div className="space-y-5 mb-6">
          {grouped.map(({ stage, entries }) => (
            <div key={stage}>
              <SubLabel className="border-b border-border pb-1 mb-2">
                {STAGE_LABELS[stage]}
              </SubLabel>
              <div className="space-y-1">
                {entries.map(({ item, idx }) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggle(idx)}
                    className="flex items-center gap-2.5 w-full text-left py-1 group"
                  >
                    {selectedIndices.has(idx) ? (
                      <CheckSquare size={16} className="flex-shrink-0 text-primary" />
                    ) : (
                      <Square size={16} className="flex-shrink-0 text-muted" />
                    )}
                    <span className={`text-sm ${selectedIndices.has(idx) ? 'text-foreground' : 'text-muted'}`}>
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted mb-6">No default checklist items for this booking stage.</p>
      )}

      <div className="border-t border-border pt-4 mb-6">
        <SubLabel className="mb-3">Add a custom item</SubLabel>
        <div className="flex gap-2">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Item label"
            className="flex-1"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomItem(); } }}
          />
          <Select value={newStage} onValueChange={setNewStage}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PROVISIONAL">Provisional</SelectItem>
              <SelectItem value="CONFIRMED">Confirmed</SelectItem>
              <SelectItem value="READY">Ready</SelectItem>
              <SelectItem value="COMPLETE">Complete</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" onClick={addCustomItem} disabled={!newLabel.trim()}>
            Add
          </Button>
        </div>
        {customItems.length > 0 && (
          <div className="mt-2 space-y-1">
            {customItems.map((ci, i) => (
              <div key={i} className="flex items-center gap-2 py-1">
                <CheckSquare size={16} className="flex-shrink-0 text-primary" />
                <span className="text-sm text-foreground flex-1">{ci.label}</span>
                <span className="text-xs text-muted">{STAGE_LABELS[ci.stage] ?? ci.stage}</span>
                <button
                  type="button"
                  onClick={() => setCustomItems((prev) => prev.filter((_, j) => j !== i))}
                  className="text-muted hover:text-foreground transition-colors"
                  aria-label="Remove item"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {isError && (
        <p className="text-sm text-status-cancelled mb-4">Failed to create booking. Please try again.</p>
      )}

      <div className="flex gap-3">
        <Button onClick={handleCreate} disabled={isCreating}>
          {isCreating ? 'Creating…' : 'Create booking'}
        </Button>
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}
