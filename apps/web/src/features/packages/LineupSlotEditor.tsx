import { X } from 'lucide-react';
import { FormField } from '@/components/common/FormField';
import { GhostButton } from '@/components/common/GhostButton';
import { IconButton } from '@/components/common/IconButton';
import { Input } from '@/components/ui/input';
import type { LineupSlotInput } from '@/types/api';

// Band members v1 (#879, ADR-0072 §3). A lineup slot is a free-text role and an order — roles
// get type-ahead + soft matching in a later slice; this editor only owns add/remove/reorder/edit.
export type LineupSlotDraft = LineupSlotInput & { key: string };

export function LineupSlotEditor({
  slots,
  onChange,
}: {
  slots: LineupSlotDraft[];
  onChange: (slots: LineupSlotDraft[]) => void;
}) {
  function update(index: number, role: string) {
    const next = [...slots];
    next[index] = { ...next[index], role };
    onChange(next);
  }

  function remove(index: number) {
    onChange(slots.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i })));
  }

  function add() {
    onChange([...slots, { key: crypto.randomUUID(), role: '', order: slots.length }]);
  }

  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">Parts</label>
      <div className="space-y-2">
        {slots.map((slot, i) => (
          <div key={slot.key} className="flex items-end gap-2">
            <FormField label="Role" className="flex-1">
              <Input
                type="text"
                value={slot.role}
                onChange={(e) => update(i, e.target.value)}
                placeholder="e.g. Saxophone"
              />
            </FormField>
            <IconButton label="Remove part" onClick={() => remove(i)} className="mb-0.5 hover:text-status-cancelled">
              <X size={16} />
            </IconButton>
          </div>
        ))}
      </div>
      <GhostButton variant="primary" onClick={add} className="mt-2">
        + Add part
      </GhostButton>
    </div>
  );
}
