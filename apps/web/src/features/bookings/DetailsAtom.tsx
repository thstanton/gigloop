import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/common/FormField';
import {
  LOGISTICS_BAND_ONLY_KEYS,
  LOGISTICS_DETAIL_FIELDS,
  LOGISTICS_FIELD_ICONS,
  LOGISTICS_SYSTEM_KEYS,
  type LogisticsDetailKey,
} from '@/lib/constants';
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


/** Everything the atom does NOT treat as a user custom field: its own detail keys plus the
 *  foreign time anchors. Whatever remains in `logistics` is a genuine custom field. */
const NON_CUSTOM_KEYS: ReadonlySet<string> = new Set<string>(LOGISTICS_SYSTEM_KEYS);

/** The non-temporal slice of `logistics` the atom produces. */
export type DetailsLogistics = Record<string, BookingLogisticsEntry>;

type LocalState = Record<LogisticsDetailKey, LocalEntry>;

// Derived from LOGISTICS_DETAIL_FIELDS rather than hand-listing each key — a table with a fixed
// column count but a growing row count (#888 added travelPlan/outfits) must not force a matching
// hand-written enumeration here, or this becomes exactly the "second hand-written list" the table
// exists to prevent.
function buildInitialState(logistics: BookingDetail['logistics']): LocalState {
  return Object.fromEntries(
    LOGISTICS_DETAIL_FIELDS.map(({ key }) => [key, entryFromBooking(logistics, key)]),
  ) as LocalState;
}

/** The detail + custom slice, ready to merge over the preserved time keys. Empty fields drop out. */
function buildDetailsPayload(fields: LocalState, customFields: CustomFieldLocal[]): DetailsLogistics {
  const systemPairs = LOGISTICS_DETAIL_FIELDS
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
  /** Gates the two Band members v1 fields (#888) — travelPlan and outfits — off entirely when
   *  false, the host's read of VITE_FEATURE_BAND_MEMBERS. */
  bandMembersEnabled?: boolean;
}

export function DetailsAtom({
  initialLogistics,
  onSave,
  isSaving,
  saved,
  saveError,
  bandMembersEnabled = false,
}: DetailsAtomProps) {
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

  function setEntry(key: LogisticsDetailKey, patch: Partial<LocalEntry>) {
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

  const visibleFields = LOGISTICS_DETAIL_FIELDS.filter(
    ({ key }) => bandMembersEnabled || !LOGISTICS_BAND_ONLY_KEYS.includes(key),
  );

  return (
    <div className="space-y-5">
      {visibleFields.map(({ key, label, control }) => {
        const entry = fields[key];
        return (
          <FormField key={key} label={label}>
            <div className={cn('flex gap-2', control === 'textarea' ? 'items-start' : 'items-center')}>
              <LogisticsIconPicker
                value={entry.icon}
                defaultIcon={LOGISTICS_FIELD_ICONS[key] ?? ''}
                onChange={(icon) => setEntry(key, { icon })}
              />
              <div className="flex-1 min-w-0">
                <DetailInput
                  fieldKey={key}
                  label={label}
                  type={control}
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
