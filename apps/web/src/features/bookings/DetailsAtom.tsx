import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/common/FormField';
import { LOGISTICS_FIELD_ICONS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import {
  CustomFieldsList,
  DetailInput,
  LogisticsIconPicker,
  buildCustomFields,
  entryFromBooking,
  getNextCustomFieldKey,
  toCustomEntry,
  toSystemEntry,
  type CustomFieldLocal,
  type LocalEntry,
} from './DetailsFields';
import type { BookingDetail, BookingLogisticsEntry } from '@/types/api';

// PRD #511 Module B — the Details atom: the *conditions* half of the temporal-in-Itinerary /
// conditions-in-Details split (ADR-0050). It edits only the non-temporal logistics fields
// (dress code, performance space, food, green room, equipment, and custom fields). The time
// anchors (arrival/soundcheck/finish) are NOT here — they belong to the Itinerary atom (#521),
// which writes the same `logistics` JSON behind an internal seam.
//
// Like the Venue/People atoms it is Sheet-agnostic and owns no mutation: it surfaces the user's
// intent via `onSave(detailsLogistics)` — the detail + custom slice only — and renders its
// Tier-1 save state from props. The host merges this slice over the preserved time keys before
// it PATCHes (a wholesale logistics write would otherwise wipe the Itinerary's anchors).
//
// Details has no detectable done-state, so it earns no completeness predicate and is never nagged.

type DetailFieldKey = 'dressCode' | 'performanceSpace' | 'foodProvided' | 'greenRoom' | 'equipmentRequired';

const DETAIL_FIELDS: Array<{ key: DetailFieldKey; label: string; type: 'input' | 'select' | 'textarea' }> = [
  { key: 'dressCode',          label: 'Dress code',          type: 'select' },
  { key: 'performanceSpace',   label: 'Performance space',   type: 'textarea' },
  { key: 'foodProvided',       label: 'Food provided',       type: 'textarea' },
  { key: 'greenRoom',          label: 'Green room',          type: 'textarea' },
  { key: 'equipmentRequired',  label: 'Equipment required',  type: 'textarea' },
];

/** The Itinerary-owned time anchors. The Details atom must NOT touch or re-emit these — they are
 *  not detail fields, and (critically) must not be mistaken for user custom fields. The host
 *  preserves them around a Details save. */
export const LOGISTICS_TIME_KEYS = ['arrivalTime', 'soundCheckTime', 'finishTime'] as const;

const DETAIL_KEYS: ReadonlySet<string> = new Set<string>(DETAIL_FIELDS.map((f) => f.key));

/** Everything the atom does NOT treat as a user custom field: its own detail keys plus the
 *  foreign time anchors. Whatever remains in `logistics` is a genuine custom field. */
const NON_CUSTOM_KEYS: ReadonlySet<string> = new Set<string>([...DETAIL_KEYS, ...LOGISTICS_TIME_KEYS]);

/** The non-temporal slice of `logistics` the atom produces. */
export type DetailsLogistics = Record<string, BookingLogisticsEntry>;

type LocalState = Record<DetailFieldKey, LocalEntry>;

function buildInitialState(logistics: BookingDetail['logistics']): LocalState {
  return {
    dressCode:         entryFromBooking(logistics, 'dressCode'),
    performanceSpace:  entryFromBooking(logistics, 'performanceSpace'),
    foodProvided:      entryFromBooking(logistics, 'foodProvided'),
    greenRoom:         entryFromBooking(logistics, 'greenRoom'),
    equipmentRequired: entryFromBooking(logistics, 'equipmentRequired'),
  };
}

/** The detail + custom slice, ready to merge over the preserved time keys. Empty fields drop out. */
function buildDetailsPayload(fields: LocalState, customFields: CustomFieldLocal[]): DetailsLogistics {
  const systemPairs = DETAIL_FIELDS
    .filter(({ key }) => fields[key].value)
    .map(({ key }) => [key, toSystemEntry(fields[key])] as const);
  const customPairs = customFields
    .filter((cf) => cf.value || cf.label)
    .map((cf) => [cf.key, toCustomEntry(cf)] as const);
  return Object.fromEntries([...systemPairs, ...customPairs]);
}

interface DetailsAtomProps {
  /** The booking's current logistics; the atom reads only its non-temporal keys. */
  initialLogistics: BookingDetail['logistics'];
  onSave: (detailsLogistics: DetailsLogistics) => void;
  // Tier-1 save state, injected by the host (the self-saving Details shell stays open and drives
  // all three; the Builder shell can drive them too).
  isSaving: boolean;
  saved: boolean;
  saveError: string | null;
}

export function DetailsAtom({ initialLogistics, onSave, isSaving, saved, saveError }: DetailsAtomProps) {
  // Self-initialized once (Venue/People style): the post-save ['booking'] refetch must not stomp
  // an in-progress edit while the self-saving shell stays open.
  const [fields, setFields] = useState<LocalState>(() => buildInitialState(initialLogistics));
  const [customFields, setCustomFields] = useState<CustomFieldLocal[]>(() =>
    buildCustomFields(initialLogistics, NON_CUSTOM_KEYS),
  );

  const initialPayload = JSON.stringify(
    buildDetailsPayload(buildInitialState(initialLogistics), buildCustomFields(initialLogistics, NON_CUSTOM_KEYS)),
  );
  const currentPayload = buildDetailsPayload(fields, customFields);
  const dirty = JSON.stringify(currentPayload) !== initialPayload;

  function setEntry(key: DetailFieldKey, patch: Partial<LocalEntry>) {
    setFields((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  function addCustomField() {
    const key = getNextCustomFieldKey(initialLogistics, customFields);
    setCustomFields((prev) => [...prev, {
      key,
      label: '',
      value: '',
      icon: '',
      shareWithBand: false,
      shareWithClient: false,
      isEditing: true,
    }]);
  }

  function updateCustomField(key: string, patch: Partial<CustomFieldLocal>) {
    setCustomFields((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }

  function removeCustomField(key: string) {
    setCustomFields((prev) => prev.filter((f) => f.key !== key));
  }

  return (
    <div className="space-y-5">
      {DETAIL_FIELDS.map(({ key, label, type }) => {
        const entry = fields[key];
        return (
          <FormField key={key} label={label}>
            <div className={cn('flex gap-2', type === 'textarea' ? 'items-start' : 'items-center')}>
              <LogisticsIconPicker
                value={entry.icon}
                defaultIcon={LOGISTICS_FIELD_ICONS[key] ?? ''}
                onChange={(icon) => setEntry(key, { icon })}
              />
              <div className="flex-1 min-w-0">
                <DetailInput
                  fieldKey={key}
                  label={label}
                  type={type}
                  value={entry.value}
                  onChange={(v) => setEntry(key, { value: v })}
                />
              </div>
            </div>
          </FormField>
        );
      })}

      <CustomFieldsList
        customFields={customFields}
        onUpdate={updateCustomField}
        onRemove={removeCustomField}
        onAdd={addCustomField}
      />

      {/* Tier-1 inline save (CLAUDE.md Loading & Feedback): disabled + "Saving…" while pending,
          inline "Saved" on success, inline error below the action. */}
      <div className="flex items-center gap-3 pt-1">
        <Button type="button" onClick={() => onSave(currentPayload)} disabled={isSaving || !dirty}>
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
        {saved && !isSaving && <span className="text-xs text-muted">Saved</span>}
        {saveError && <p className="text-sm text-status-cancelled">{saveError}</p>}
      </div>
    </div>
  );
}
