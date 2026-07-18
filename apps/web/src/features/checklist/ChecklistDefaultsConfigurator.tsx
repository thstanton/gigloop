import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/common/Card';
import { apiPatch } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  REMINDER_CONCERN_LABELS,
  REMINDER_CONCERN_ORDER,
  CHECKLIST_STAGE_ORDER,
  BOOKING_STATUS_LABELS,
  MUSIC_FORM_GATED_CHECKLIST_KEYS,
} from '@/lib/constants';
import type {
  UserProfile,
  UserPreferences,
  DueDateRule,
  ChecklistDefaultItem,
  ReminderConcern,
  BookingStatus,
} from '@/types/api';

// The configurator's lifecycle stages, in canonical order — system goals are grouped under these
// by `requiredForStatus`. The goal *list itself* is not hardcoded here (#615): it is derived from
// the fetched backend defaults (`/me` preferences.checklistDefaults) so it can never drift from the
// catalogue. Enquiry is rendered as the opening marker separately; system goals start at
// Provisional, so the displayed stages are the lifecycle order minus null/Enquiry.
const SETTINGS_STAGES = CHECKLIST_STAGE_ORDER.filter(
  (s): s is BookingStatus => s !== null && s !== 'ENQUIRY',
);

function formatDueDateRule(rule: DueDateRule | null): string {
  if (!rule) return 'No due date';
  const days = Math.abs(rule.offsetDays);
  let direction: string;
  if (rule.offsetDays < 0) direction = 'before';
  else if (rule.offsetDays > 0) direction = 'after';
  else direction = 'on';
  const basis = rule.basis === 'bookingDate' ? 'booking date' : 'booking creation';
  if (direction === 'on') return `On ${basis}`;
  return `${days} day${days !== 1 ? 's' : ''} ${direction} ${basis}`;
}

type CustomItemForm = {
  label: string;
  completedBy: 'USER' | 'CUSTOMER';
  requiredForStatus: 'NONE' | 'CONFIRMED' | 'READY' | 'COMPLETE';
  // The concern this global custom belongs to, so it appears in that section on every booking
  // (#561). 'NONE' = concern-less (lives in the create form's "Other items").
  concern: ReminderConcern | 'NONE';
  dueDateBasis: 'bookingDate' | 'bookingCreation';
  dueDateOffset: string; // signed: negative = before
  hasDueDate: boolean;
};

// A "Section" (concern) picker for a global custom checklist item, reused by the add form and both
// edit forms (#561). Kept inline as a render helper — extracting a shared component is its own work.
function ConcernSelect({
  value,
  onChange,
}: {
  value: ReminderConcern | 'NONE';
  onChange: (v: ReminderConcern | 'NONE') => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ReminderConcern | 'NONE')}>
      <SelectTrigger className="w-40 text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="NONE">No section</SelectItem>
        {REMINDER_CONCERN_ORDER.map((c) => (
          <SelectItem key={c} value={c}>{REMINDER_CONCERN_LABELS[c]}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Local pill toggle + save bar. These mirror the small primitives SettingsPage uses across its
// sections; kept local to this feature component so it does not import from a page file.
function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        'relative inline-flex w-9 h-5 rounded-full transition-colors duration-150 flex-shrink-0',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        checked && !disabled ? 'bg-primary' : 'bg-border',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-150',
          checked ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  );
}

function SaveBar({
  isPending,
  saved,
  isError,
  onSave,
}: {
  isPending: boolean;
  saved: boolean;
  isError: boolean;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center gap-4 pt-2">
      <Button type="button" onClick={onSave} disabled={isPending}>
        {isPending ? 'Saving…' : 'Save changes'}
      </Button>
      {saved && !isPending && <span className="text-sm text-muted">Saved</span>}
      {isError && !isPending && (
        <span className="text-sm text-status-cancelled">Something went wrong</span>
      )}
    </div>
  );
}

/**
 * The Settings "Checklist" configurator: which system goals are seeded on every new booking, their
 * due dates, and the musician's own custom default items. Extracted from SettingsPage (#620 / #717)
 * so the goal-world rebuild (#718) lands as a self-contained change. `songFormEnabled` is passed in
 * from the sibling "General" subsection so toggling the song request form gates the music items
 * without a save (the two subsections share that one value).
 */
export function ChecklistDefaultsConfigurator({
  profile,
  songFormEnabled,
}: {
  profile: UserProfile;
  songFormEnabled: boolean;
}) {
  const queryClient = useQueryClient();
  const prefs = profile.preferences as UserPreferences | undefined;
  const savedDefaults = useMemo(() => prefs?.checklistDefaults ?? [], [prefs]);

  // System goals are sourced from the fetched backend defaults — never a hardcoded duplicate
  // (#615, ADR-0057). Every system goal (key != null) carries its effective label, stage,
  // completedBy, enabled and dueDateRule from the catalogue/overrides the backend already merged,
  // so a goal added, renamed or re-staged in the catalogue appears here with no hand-sync, and
  // ALL_SYSTEM_KEYS always matches the backend's system keys (no stale-key save regression).
  const systemGoals = useMemo(
    () => savedDefaults.filter((d): d is ChecklistDefaultItem & { key: string } => d.key != null),
    [savedDefaults],
  );
  const ALL_SYSTEM_KEYS = useMemo(() => systemGoals.map((g) => g.key), [systemGoals]);
  const stageGroups = useMemo(() => {
    const byStage = new Map<string, Array<ChecklistDefaultItem & { key: string }>>();
    for (const goal of systemGoals) {
      const stage = goal.requiredForStatus;
      if (!stage) continue;
      if (!byStage.has(stage)) byStage.set(stage, []);
      byStage.get(stage)!.push(goal);
    }
    return SETTINGS_STAGES.map((stage) => ({
      stage,
      label: BOOKING_STATUS_LABELS[stage],
      items: byStage.get(stage) ?? [],
    }));
  }, [systemGoals]);

  const [checklistSaved, setChecklistSaved] = useState(false);

  // System item overrides: key → { enabled, dueDateRule }. The fetched defaults already carry the
  // effective (catalogue-default merged with any saved override) enabled/dueDateRule per goal.
  const initialOverrides: Record<string, { enabled: boolean; dueDateRule: DueDateRule | null }> = {};
  for (const goal of systemGoals) {
    initialOverrides[goal.key] = {
      enabled: goal.enabled !== false,
      dueDateRule: goal.dueDateRule ?? null,
    };
  }
  const [overrides, setOverrides] = useState(initialOverrides);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editBasis, setEditBasis] = useState<'bookingDate' | 'bookingCreation'>('bookingDate');
  const [editOffset, setEditOffset] = useState(0); // signed: negative = before

  // Custom items are the user's own global-template goals (no catalogue key).
  const initialCustom: ChecklistDefaultItem[] = savedDefaults.filter((d) => d.key == null);
  const [customItems, setCustomItems] = useState<ChecklistDefaultItem[]>(initialCustom);
  useEffect(() => {
    const p = profile.preferences as UserPreferences | undefined;
    const defaults = p?.checklistDefaults ?? [];
    setCustomItems(defaults.filter((d) => d.key == null));
  }, [profile]);
  const [newItem, setNewItem] = useState<CustomItemForm>({
    label: '',
    completedBy: 'USER',
    requiredForStatus: 'NONE',
    concern: 'NONE',
    dueDateBasis: 'bookingDate',
    dueDateOffset: '',
    hasDueDate: false,
  });

  // Custom item editing
  const [editingCustomIdx, setEditingCustomIdx] = useState<number | null>(null);
  const [editCustom, setEditCustom] = useState<CustomItemForm | null>(null);

  function startEditCustom(idx: number) {
    const item = customItems[idx];
    const days = item.dueDateRule?.offsetDays ?? 0;
    setEditingCustomIdx(idx);
    setEditCustom({
      label: item.label,
      completedBy: item.completedBy === 'BAND_MEMBER' ? 'USER' : item.completedBy,
      requiredForStatus: (item.requiredForStatus ?? 'NONE') as CustomItemForm['requiredForStatus'],
      concern: (item.concern ?? 'NONE') as ReminderConcern | 'NONE',
      hasDueDate: !!item.dueDateRule,
      dueDateBasis: item.dueDateRule?.basis ?? 'bookingDate',
      dueDateOffset: days.toString(),
    });
  }

  function saveEditCustom() {
    if (!editCustom || editingCustomIdx === null) return;
    const dueDateRule: DueDateRule | null =
      editCustom.hasDueDate && editCustom.dueDateOffset !== ''
        ? { basis: editCustom.dueDateBasis, offsetDays: Number(editCustom.dueDateOffset) }
        : null;
    setCustomItems((prev) =>
      prev.map((item, i) =>
        i === editingCustomIdx
          ? {
              ...item,
              label: editCustom.label.trim() || item.label,
              completedBy: editCustom.completedBy,
              requiredForStatus: editCustom.requiredForStatus === 'NONE'
                ? null
                : (editCustom.requiredForStatus as ChecklistDefaultItem['requiredForStatus']),
              concern: editCustom.concern === 'NONE' ? null : editCustom.concern,
              dueDateRule,
            }
          : item,
      ),
    );
    setEditingCustomIdx(null);
    setEditCustom(null);
  }

  function toggleCustomEnabled(idx: number, value: boolean) {
    setCustomItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, enabled: value ? undefined : false } : item)),
    );
  }

  // Group custom items by stage for merged rendering
  const customByStage = new Map<string | null, Array<{ item: ChecklistDefaultItem; idx: number }>>();
  customItems.forEach((item, idx) => {
    const key = item.requiredForStatus ?? null;
    if (!customByStage.has(key)) customByStage.set(key, []);
    customByStage.get(key)!.push({ item, idx });
  });
  const nullStageCustom = customByStage.get(null) ?? [];

  const checklistMutation = useMutation({
    mutationFn: () =>
      apiPatch<UserProfile>('/me/preferences/checklist-defaults', {
        systemItemOverrides: ALL_SYSTEM_KEYS.map((key) => ({
          key,
          enabled: overrides[key]?.enabled ?? true,
          dueDateRule: overrides[key]?.dueDateRule ?? null,
        })),
        customItems: customItems.map((item) => ({
          label: item.label,
          completedBy: item.completedBy,
          requiredForStatus: item.requiredForStatus ?? null,
          concern: item.concern ?? null,
          dueDateRule: item.dueDateRule ?? null,
          ...(item.enabled === false ? { enabled: false } : {}),
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setChecklistSaved(true);
      setTimeout(() => setChecklistSaved(false), 3000);
    },
    onError: () => toast({ title: 'Failed to save checklist defaults', variant: 'destructive' }),
  });

  const startEdit = (key: string) => {
    const current = overrides[key]?.dueDateRule;
    const days = current?.offsetDays ?? 0;
    setEditBasis(current?.basis ?? 'bookingDate');
    setEditOffset(days);
    setEditingKey(key);
  };

  const saveEdit = (key: string, enabled: boolean) => {
    setOverrides((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        dueDateRule: enabled ? { basis: editBasis, offsetDays: editOffset } : null,
      },
    }));
    setEditingKey(null);
  };

  const toggleItemEnabled = (key: string, value: boolean) => {
    setOverrides((prev) => ({ ...prev, [key]: { ...prev[key], enabled: value } }));
  };

  const addCustomItem = () => {
    if (!newItem.label.trim()) return;
    const dueDateRule: DueDateRule | null =
      newItem.hasDueDate && newItem.dueDateOffset !== ''
        ? { basis: newItem.dueDateBasis, offsetDays: Number(newItem.dueDateOffset) }
        : null;
    setCustomItems((prev) => [
      ...prev,
      {
        key: null,
        label: newItem.label.trim(),
        completedBy: newItem.completedBy,
        autoCompleteRule: null,
        requiredForStatus: (newItem.requiredForStatus === 'NONE' ? null : newItem.requiredForStatus) as ChecklistDefaultItem['requiredForStatus'],
        concern: newItem.concern === 'NONE' ? null : newItem.concern,
        dueDateRule,
      },
    ]);
    setNewItem({ label: '', completedBy: 'USER', requiredForStatus: 'NONE', concern: 'NONE', dueDateBasis: 'bookingDate', dueDateOffset: '', hasDueDate: false });
  };

  return (
    <>
      <div className="space-y-4 mb-6">
        {/* Enquiry start marker */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[10px] font-medium text-muted uppercase tracking-wider px-2">Enquiry</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Null-stage custom items at top (no stage requirement) */}
        {nullStageCustom.length > 0 && (
          <div className="space-y-2">
            {nullStageCustom.map(({ item, idx }) =>
              editingCustomIdx === idx ? (
                <div key={`edit-${idx}`} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      value={editCustom!.label}
                      onChange={(e) => setEditCustom((p) => p && { ...p, label: e.target.value })}
                      placeholder="Item label"
                      className="text-sm flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => { setCustomItems((prev) => prev.filter((_, i) => i !== idx)); setEditingCustomIdx(null); setEditCustom(null); }}
                      className="text-muted hover:text-status-cancelled transition-colors flex-shrink-0"
                      aria-label="Delete item"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Select value={editCustom!.completedBy} onValueChange={(v) => setEditCustom((p) => p && { ...p, completedBy: v as 'USER' | 'CUSTOMER' })}>
                      <SelectTrigger className="w-32 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USER">By me</SelectItem>
                        <SelectItem value="CUSTOMER">By client</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={editCustom!.requiredForStatus} onValueChange={(v) => setEditCustom((p) => p && { ...p, requiredForStatus: v as CustomItemForm['requiredForStatus'] })}>
                      <SelectTrigger className="w-48 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">Not required for a stage</SelectItem>
                        <SelectItem value="CONFIRMED">Required for Confirmed</SelectItem>
                        <SelectItem value="READY">Required for Ready</SelectItem>
                        <SelectItem value="COMPLETE">Required for Complete</SelectItem>
                      </SelectContent>
                    </Select>
                    <ConcernSelect value={editCustom!.concern} onChange={(v) => setEditCustom((p) => p && { ...p, concern: v })} />
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editCustom!.hasDueDate} onChange={(e) => setEditCustom((p) => p && { ...p, hasDueDate: e.target.checked })} className="rounded border-border" />
                      <span className="text-xs text-foreground">Due date</span>
                    </label>
                    {editCustom!.hasDueDate && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <input type="number" min={0} value={Math.abs(Number(editCustom!.dueDateOffset))} onChange={(e) => setEditCustom((p) => { if (!p) return p; const sign = Number(p.dueDateOffset) < 0 ? -1 : 1; return { ...p, dueDateOffset: (sign * Number(e.target.value)).toString() }; })} placeholder="14" className="w-14 text-xs border border-border rounded px-2 py-1 bg-background" />
                        <span className="text-xs text-muted">days</span>
                        <select value={Number(editCustom!.dueDateOffset) < 0 ? 'before' : 'after'} onChange={(e) => setEditCustom((p) => { if (!p) return p; const abs = Math.abs(Number(p.dueDateOffset)); return { ...p, dueDateOffset: (e.target.value === 'before' ? -abs : abs).toString() }; })} className="text-xs border border-border rounded px-2 py-1 bg-background">
                          <option value="before">before</option>
                          <option value="after">after</option>
                        </select>
                        <select value={editCustom!.dueDateBasis} onChange={(e) => setEditCustom((p) => p && { ...p, dueDateBasis: e.target.value as 'bookingDate' | 'bookingCreation' })} className="text-xs border border-border rounded px-2 py-1 bg-background">
                          <option value="bookingDate">booking date</option>
                          <option value="bookingCreation">booking creation</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" className="text-xs h-7" onClick={saveEditCustom} disabled={!editCustom!.label.trim()}>Save</Button>
                    <Button type="button" size="sm" variant="ghost" className="text-xs h-7" onClick={() => { setEditingCustomIdx(null); setEditCustom(null); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div key={`custom-${idx}`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <Toggle checked={item.enabled !== false} onChange={(v) => toggleCustomEnabled(idx, v)} />
                  <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                    <span className={cn('text-sm', item.enabled !== false ? 'text-foreground' : 'text-muted')}>{item.label}</span>
                    <span className="text-xs text-muted border border-border rounded px-1 py-0.5 leading-none">{item.completedBy === 'CUSTOMER' ? 'Client' : 'Me'}</span>
                    <span className="text-xs text-primary/60 border border-primary/30 rounded px-1 py-0.5 leading-none">Custom</span>
                    {item.concern && <span className="text-xs text-muted border border-border rounded px-1 py-0.5 leading-none">{REMINDER_CONCERN_LABELS[item.concern as ReminderConcern]}</span>}
                  </div>
                  <div className="w-full sm:w-auto pl-12 sm:pl-0">
                    <button type="button" onClick={() => startEditCustom(idx)} className="flex items-center gap-1 text-xs text-primary hover:underline" aria-label={`Edit ${item.label}`}>
                      {formatDueDateRule(item.dueDateRule)}<Pencil size={11} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* Stage groups: items first, then stage milestone divider below */}
        {stageGroups.map(({ stage, label: stageLabel, items }) => {
          const stageCustom = customByStage.get(stage) ?? [];
          return (
            <div key={stage}>
              <div className="space-y-2 mb-3">
                {items.map((item) => {
                  const isGated = MUSIC_FORM_GATED_CHECKLIST_KEYS.includes(item.key) && !songFormEnabled;
                  const itemEnabled = overrides[item.key]?.enabled ?? true;
                  const effective = isGated ? false : itemEnabled;
                  return (
                    <div key={item.key}>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <Toggle checked={effective} onChange={(v) => !isGated && toggleItemEnabled(item.key, v)} disabled={isGated} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn('text-sm', effective ? 'text-foreground' : 'text-muted')}>{item.label}</span>
                            <span className="text-xs text-muted border border-border rounded px-1 py-0.5 leading-none">{item.completedBy === 'CUSTOMER' ? 'Client' : 'Me'}</span>
                          </div>
                          {isGated && <p className="text-xs text-muted mt-0.5">Enable song request form to include this item</p>}
                        </div>
                        <div className="w-full sm:w-auto pl-12 sm:pl-0">
                          {editingKey === item.key ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <input type="number" min={0} value={Math.abs(editOffset)} onChange={(e) => setEditOffset((editOffset < 0 ? -1 : 1) * Number(e.target.value))} className="w-14 text-xs border border-border rounded px-2 py-1 bg-background" placeholder="14" />
                              <span className="text-xs text-muted">days</span>
                              <select value={editOffset < 0 ? 'before' : 'after'} onChange={(e) => setEditOffset(e.target.value === 'before' ? -Math.abs(editOffset) : Math.abs(editOffset))} className="text-xs border border-border rounded px-2 py-1 bg-background">
                                <option value="before">before</option>
                                <option value="after">after</option>
                              </select>
                              <select value={editBasis} onChange={(e) => setEditBasis(e.target.value as 'bookingDate' | 'bookingCreation')} className="text-xs border border-border rounded px-2 py-1 bg-background">
                                <option value="bookingDate">booking date</option>
                                <option value="bookingCreation">booking creation</option>
                              </select>
                              <Button type="button" size="sm" variant="outline" className="text-xs h-7" onClick={() => saveEdit(item.key, true)}>Save</Button>
                              <Button type="button" size="sm" variant="ghost" className="text-xs h-7" onClick={() => saveEdit(item.key, false)}>No date</Button>
                              <Button type="button" size="sm" variant="ghost" className="text-xs h-7" onClick={() => setEditingKey(null)}>Cancel</Button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => startEdit(item.key)} className="flex items-center gap-1 text-xs text-primary hover:underline">
                              {formatDueDateRule(overrides[item.key]?.dueDateRule ?? null)}<Pencil size={11} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {stageCustom.map(({ item, idx }) =>
                  editingCustomIdx === idx ? (
                    <div key={`edit-${idx}`} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <Input type="text" value={editCustom!.label} onChange={(e) => setEditCustom((p) => p && { ...p, label: e.target.value })} placeholder="Item label" className="text-sm flex-1" />
                        <button type="button" onClick={() => { setCustomItems((prev) => prev.filter((_, i) => i !== idx)); setEditingCustomIdx(null); setEditCustom(null); }} className="text-muted hover:text-status-cancelled transition-colors flex-shrink-0" aria-label="Delete item">
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Select value={editCustom!.completedBy} onValueChange={(v) => setEditCustom((p) => p && { ...p, completedBy: v as 'USER' | 'CUSTOMER' })}>
                          <SelectTrigger className="w-32 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USER">By me</SelectItem>
                            <SelectItem value="CUSTOMER">By client</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={editCustom!.requiredForStatus} onValueChange={(v) => setEditCustom((p) => p && { ...p, requiredForStatus: v as CustomItemForm['requiredForStatus'] })}>
                          <SelectTrigger className="w-48 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NONE">Not required for a stage</SelectItem>
                            <SelectItem value="CONFIRMED">Required for Confirmed</SelectItem>
                            <SelectItem value="READY">Required for Ready</SelectItem>
                            <SelectItem value="COMPLETE">Required for Complete</SelectItem>
                          </SelectContent>
                        </Select>
                        <ConcernSelect value={editCustom!.concern} onChange={(v) => setEditCustom((p) => p && { ...p, concern: v })} />
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={editCustom!.hasDueDate} onChange={(e) => setEditCustom((p) => p && { ...p, hasDueDate: e.target.checked })} className="rounded border-border" />
                          <span className="text-xs text-foreground">Due date</span>
                        </label>
                        {editCustom!.hasDueDate && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <input type="number" min={0} value={Math.abs(Number(editCustom!.dueDateOffset))} onChange={(e) => setEditCustom((p) => { if (!p) return p; const sign = Number(p.dueDateOffset) < 0 ? -1 : 1; return { ...p, dueDateOffset: (sign * Number(e.target.value)).toString() }; })} placeholder="14" className="w-14 text-xs border border-border rounded px-2 py-1 bg-background" />
                            <span className="text-xs text-muted">days</span>
                            <select value={Number(editCustom!.dueDateOffset) < 0 ? 'before' : 'after'} onChange={(e) => setEditCustom((p) => { if (!p) return p; const abs = Math.abs(Number(p.dueDateOffset)); return { ...p, dueDateOffset: (e.target.value === 'before' ? -abs : abs).toString() }; })} className="text-xs border border-border rounded px-2 py-1 bg-background">
                              <option value="before">before</option>
                              <option value="after">after</option>
                            </select>
                            <select value={editCustom!.dueDateBasis} onChange={(e) => setEditCustom((p) => p && { ...p, dueDateBasis: e.target.value as 'bookingDate' | 'bookingCreation' })} className="text-xs border border-border rounded px-2 py-1 bg-background">
                              <option value="bookingDate">booking date</option>
                              <option value="bookingCreation">booking creation</option>
                            </select>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" variant="outline" className="text-xs h-7" onClick={saveEditCustom} disabled={!editCustom!.label.trim()}>Save</Button>
                        <Button type="button" size="sm" variant="ghost" className="text-xs h-7" onClick={() => { setEditingCustomIdx(null); setEditCustom(null); }}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div key={`custom-${idx}`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <Toggle checked={item.enabled !== false} onChange={(v) => toggleCustomEnabled(idx, v)} />
                      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                        <span className={cn('text-sm', item.enabled !== false ? 'text-foreground' : 'text-muted')}>{item.label}</span>
                        <span className="text-xs text-muted border border-border rounded px-1 py-0.5 leading-none">{item.completedBy === 'CUSTOMER' ? 'Client' : 'Me'}</span>
                        <span className="text-xs text-primary/60 border border-primary/30 rounded px-1 py-0.5 leading-none">Custom</span>
                        {item.concern && <span className="text-xs text-muted border border-border rounded px-1 py-0.5 leading-none">{REMINDER_CONCERN_LABELS[item.concern as ReminderConcern]}</span>}
                      </div>
                      <div className="w-full sm:w-auto pl-12 sm:pl-0">
                        <button type="button" onClick={() => startEditCustom(idx)} className="flex items-center gap-1 text-xs text-primary hover:underline" aria-label={`Edit ${item.label}`}>
                          {formatDueDateRule(item.dueDateRule)}<Pencil size={11} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
              {/* Stage milestone divider — below items; omitted for Complete (terminal stage) */}
              {stage !== 'COMPLETE' && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] font-medium text-muted uppercase tracking-wider px-2">{stageLabel}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Card title="Add custom item" className="space-y-3 mb-6">
        <div className="space-y-2">
          <Input
            placeholder="Item label"
            value={newItem.label}
            onChange={(e) => setNewItem((p) => ({ ...p, label: e.target.value }))}
          />
          <div className="flex gap-2 flex-wrap">
            <Select value={newItem.completedBy} onValueChange={(v) => setNewItem((p) => ({ ...p, completedBy: v as 'USER' | 'CUSTOMER' }))}>
              <SelectTrigger className="w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">By me</SelectItem>
                <SelectItem value="CUSTOMER">By client</SelectItem>
              </SelectContent>
            </Select>
            <Select value={newItem.requiredForStatus} onValueChange={(v) => setNewItem((p) => ({ ...p, requiredForStatus: v as CustomItemForm['requiredForStatus'] }))}>
              <SelectTrigger className="w-48 text-xs"><SelectValue placeholder="Stage requirement" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Not required for a stage</SelectItem>
                <SelectItem value="CONFIRMED">Required for Confirmed</SelectItem>
                <SelectItem value="READY">Required for Ready</SelectItem>
                <SelectItem value="COMPLETE">Required for Complete</SelectItem>
              </SelectContent>
            </Select>
            <ConcernSelect value={newItem.concern} onChange={(v) => setNewItem((p) => ({ ...p, concern: v }))} />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newItem.hasDueDate}
                onChange={(e) => setNewItem((p) => ({ ...p, hasDueDate: e.target.checked }))}
                className="rounded border-border"
              />
              <span className="text-xs text-foreground">Set due date</span>
            </label>
            {newItem.hasDueDate && (
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="number"
                  min={0}
                  value={Math.abs(Number(newItem.dueDateOffset))}
                  onChange={(e) => setNewItem((p) => { const sign = Number(p.dueDateOffset) < 0 ? -1 : 1; return { ...p, dueDateOffset: (sign * Number(e.target.value)).toString() }; })}
                  placeholder="14"
                  className="w-14 text-xs border border-border rounded px-2 py-1 bg-background"
                />
                <span className="text-xs text-muted">days</span>
                <select
                  value={Number(newItem.dueDateOffset) < 0 ? 'before' : 'after'}
                  onChange={(e) => setNewItem((p) => { const abs = Math.abs(Number(p.dueDateOffset)); return { ...p, dueDateOffset: (e.target.value === 'before' ? -abs : abs).toString() }; })}
                  className="text-xs border border-border rounded px-2 py-1 bg-background"
                >
                  <option value="before">before</option>
                  <option value="after">after</option>
                </select>
                <select
                  value={newItem.dueDateBasis}
                  onChange={(e) => setNewItem((p) => ({ ...p, dueDateBasis: e.target.value as 'bookingDate' | 'bookingCreation' }))}
                  className="text-xs border border-border rounded px-2 py-1 bg-background"
                >
                  <option value="bookingDate">booking date</option>
                  <option value="bookingCreation">booking creation</option>
                </select>
              </div>
            )}
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addCustomItem} disabled={!newItem.label.trim()}>
            <Plus size={14} className="mr-1" />
            Add
          </Button>
        </div>
      </Card>

      <SaveBar
        isPending={checklistMutation.isPending}
        saved={checklistSaved}
        isError={checklistMutation.isError}
        onSave={() => checklistMutation.mutate()}
      />
    </>
  );
}
