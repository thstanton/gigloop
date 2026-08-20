import { FormField } from '@/components/common/FormField';
import { Input } from '@/components/ui/input';
import type { LineupTemplate } from '@/types/api';
import { LineupSlotEditor, type LineupSlotDraft } from './LineupSlotEditor';

// ─── Form value shape + conversions ──────────────────────────────────────────
// Symmetric with PackageForm/PackageDrawer (ADR-0046, ADR-0072 §3). Presentational and fully
// controlled: the container (LineupDrawer) owns the value and receives partial patches.

export interface LineupFormValues {
  label: string;
  slots: LineupSlotDraft[];
}

export function emptyLineupFormValues(): LineupFormValues {
  return { label: '', slots: [] };
}

export function lineupToFormValues(lineup: LineupTemplate): LineupFormValues {
  return {
    label: lineup.label ?? '',
    slots: lineup.slots.map((s) => ({ ...s, key: s.id })),
  };
}

export function lineupFormToPayload(v: LineupFormValues) {
  return {
    label: v.label.trim(),
    slots: v.slots.map((s, i) => ({
      id: s.id,
      role: s.role.trim(),
      order: i,
    })),
  };
}

export function LineupForm({
  value,
  onChange,
}: {
  value: LineupFormValues;
  onChange: (patch: Partial<LineupFormValues>) => void;
}) {
  return (
    <div className="space-y-5">
      <FormField label="Label">
        <Input
          type="text"
          value={value.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="e.g. My five-piece"
        />
      </FormField>

      <LineupSlotEditor slots={value.slots} onChange={(slots) => onChange({ slots })} />
    </div>
  );
}
