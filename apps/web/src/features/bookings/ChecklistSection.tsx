import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useChecklistActions } from '@/lib/hooks/useChecklistActions';
import { Button } from '@/components/ui/button';
import { GhostButton } from '@/components/common/GhostButton';
import { BookingConceptCardContainer } from './BookingConceptCardContainer';
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
import { BOOKING_STATUS_LABELS, STATUS_ORDER } from '@/lib/constants';
import { GoalRow } from './GoalRow';
import type { ChecklistShortcutHandlers } from './checklistShortcuts';
import type { BookingStatus, ChecklistItem } from '@/types/api';

type GoalState = 'COMPLETE' | 'PENDING' | 'SKIPPED';

// A goal's `requiredForStatus` is the *target* — the next gate it must be done before. The goal is
// therefore worked *during the preceding stage* (its "bracket"), and that bracket is the section it
// belongs to: a goal gating COMPLETE is worked while READY, so it sits in the Ready section. So the
// current-stage section answers "what's left to advance from here?" (e.g. a CONFIRMED booking's
// open section holds the READY-gated work). A goal with no target lives in the "Anytime" section.
const BRACKET_KEYS: BookingStatus[] = ['ENQUIRY', 'PROVISIONAL', 'CONFIRMED', 'READY'];
const ANYTIME_KEY = 'anytime';

// bracket (the stage you select / the section) → target stored as requiredForStatus (the next gate).
const BRACKET_TO_TARGET: Record<string, BookingStatus> = {
  ENQUIRY: 'PROVISIONAL',
  PROVISIONAL: 'CONFIRMED',
  CONFIRMED: 'READY',
  READY: 'COMPLETE',
};
// target (requiredForStatus) → bracket (the section it groups into = the preceding stage).
const TARGET_TO_BRACKET: Record<string, BookingStatus> = {
  PROVISIONAL: 'ENQUIRY',
  CONFIRMED: 'PROVISIONAL',
  READY: 'CONFIRMED',
  COMPLETE: 'READY',
};

type SectionRelation = 'past' | 'current' | 'future' | 'anytime';

// A stage section's relation to the booking's current status: behind it (past, collapsed but
// present), at it (current, open), or ahead of it (future, previewed).
function stageRelation(stage: BookingStatus, bookingIdx: number): SectionRelation {
  const idx = STATUS_ORDER.indexOf(stage);
  if (idx < bookingIdx) return 'past';
  if (idx === bookingIdx) return 'current';
  return 'future';
}

interface Section {
  key: string;
  label: string;
  relation: SectionRelation;
  goals: ChecklistItem[];
  done: number; // COMPLETE goals
  total: number; // goals that count toward the gate (SKIPPED excluded)
}

// Group goals by their bracket (ADR-0057 / #604): the stage during which the goal is worked, which
// is the stage *before* its target gate. Each bracket relative to the booking's status is past /
// current / future; the no-target goals form an always-open "Anytime" section. The current bracket
// answers "what's left to advance from here?" and opens by default; a left-behind goal stays visible
// in its (collapsed) past bracket rather than vanishing.
function buildSections(items: ChecklistItem[], bookingStatus: BookingStatus): Section[] {
  const byBracket = new Map<string, ChecklistItem[]>();
  for (const item of items) {
    const k = item.requiredForStatus ? TARGET_TO_BRACKET[item.requiredForStatus] : ANYTIME_KEY;
    if (!byBracket.has(k)) byBracket.set(k, []);
    byBracket.get(k)!.push(item);
  }
  const bookingIdx = STATUS_ORDER.indexOf(bookingStatus);

  const count = (goals: ChecklistItem[]) => ({
    done: goals.filter((g) => g.state === 'COMPLETE').length,
    total: goals.filter((g) => g.state !== 'SKIPPED').length,
  });

  const sections: Section[] = [];

  // Bracket sections in lifecycle order (past above current above future, matching the #604 layout)…
  for (const bracket of BRACKET_KEYS) {
    const goals = byBracket.get(bracket);
    if (!goals?.length) continue;
    const relation = stageRelation(bracket, bookingIdx);
    sections.push({ key: bracket, label: BOOKING_STATUS_LABELS[bracket], relation, goals, ...count(goals) });
  }

  // …then the always-present "Anytime" catch-all last, so there is always a home to add an ad-hoc
  // goal to without an empty header leading the list.
  const anytimeGoals = byBracket.get(ANYTIME_KEY) ?? [];
  sections.push({ key: ANYTIME_KEY, label: 'Anytime', relation: 'anytime', goals: anytimeGoals, ...count(anytimeGoals) });

  return sections;
}

// The stage section to open by default: the current stage if it has goals, else the earliest future
// stage with goals (when the booking sits before its first gate, e.g. an ENQUIRY). Past stays shut.
function defaultOpenStage(sections: Section[]): string | null {
  const current = sections.find((s) => s.relation === 'current' && s.goals.length > 0);
  if (current) return current.key;
  return sections.find((s) => s.relation === 'future' && s.goals.length > 0)?.key ?? null;
}

interface AddChecklistItemFormProps {
  initialStage?: string;
  onSave: (data: { label: string; requiredForStatus: string | null; dueDate: string | null }) => void;
  isSaving: boolean;
  onDone: () => void;
}

function AddChecklistItemForm({ initialStage = 'NONE', onSave, isSaving, onDone }: AddChecklistItemFormProps) {
  const [label, setLabel] = useState('');
  const [stage, setStage] = useState(initialStage);
  const [dueDate, setDueDate] = useState('');

  return (
    <div className="mt-2 space-y-2.5 rounded-md border border-border bg-surface p-3">
      <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Item label" className="text-sm" autoFocus />
      <div className="space-y-1">
        <Select value={stage} onValueChange={setStage}>
          <SelectTrigger className="h-8 w-full text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NONE">Anytime (no stage)</SelectItem>
            <SelectItem value="ENQUIRY">Enquiry stage</SelectItem>
            <SelectItem value="PROVISIONAL">Provisional stage</SelectItem>
            <SelectItem value="CONFIRMED">Confirmed stage</SelectItem>
            <SelectItem value="READY">Ready stage</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted">The stage you do this in — it must be done to move on from there.</p>
      </div>
      <DatePicker value={dueDate} onChange={setDueDate} placeholder="Due date (optional)" className="h-8 text-sm" />
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => onSave({ label: label.trim(), requiredForStatus: stage === 'NONE' ? null : BRACKET_TO_TARGET[stage], dueDate: dueDate || null })}
          disabled={!label.trim() || isSaving}
        >
          {isSaving ? 'Adding…' : 'Add'}
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

interface StatusSectionProps {
  section: Section;
  isOpen: boolean;
  onToggleOpen: () => void;
  handlers: ChecklistShortcutHandlers;
  onSetState: (itemId: string, state: GoalState) => void;
  isAdding: boolean;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onAddItem: (data: { label: string; requiredForStatus: string | null; dueDate: string | null }) => void;
  isAddingItem: boolean;
  clientName: string | null;
}

function StatusSection({
  section,
  isOpen,
  onToggleOpen,
  handlers,
  onSetState,
  isAdding,
  onStartAdd,
  onCancelAdd,
  onAddItem,
  isAddingItem,
  clientName,
}: StatusSectionProps) {
  const isCurrent = section.relation === 'current';
  return (
    <section className="border-t border-border first:border-t-0">
      <button
        onClick={onToggleOpen}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-1.5 py-2.5 text-left"
      >
        {isOpen ? <ChevronDown size={13} className="flex-shrink-0 text-muted" /> : <ChevronRight size={13} className="flex-shrink-0 text-muted" />}
        <span className={cn('text-xs font-semibold uppercase tracking-wider', isCurrent ? 'text-foreground' : 'text-muted')}>
          {section.label}
        </span>
        {section.total > 0 && (
          <span className="ml-auto flex-shrink-0 text-xs tabular-nums text-muted">
            {section.done}/{section.total}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="pb-2">
          {section.goals.map((item) => (
            <GoalRow key={item.id} item={item} handlers={handlers} onSetState={onSetState} clientName={clientName} />
          ))}

          {isAdding ? (
            <AddChecklistItemForm
              initialStage={section.key === ANYTIME_KEY ? 'NONE' : section.key}
              onSave={(data) => onAddItem(data)}
              isSaving={isAddingItem}
              onDone={onCancelAdd}
            />
          ) : (
            <GhostButton onClick={onStartAdd} variant="primary" size="xs" icon={<Plus size={12} />} className="mt-1">
              Add item
            </GhostButton>
          )}
        </div>
      )}
    </section>
  );
}

export interface ChecklistSectionProps {
  bookingId: string;
  items: ChecklistItem[];
  isLoading: boolean;
  bookingStatus: BookingStatus;
  onToggle: (itemId: string, newState: GoalState) => void;
  onAddItem: (data: { label: string; requiredForStatus: string | null; dueDate: string | null }) => void;
  isAddingItem?: boolean;
  hideHeader?: boolean;
  // #634: the booking's client name (greeting name → full name → null) for "Waiting on …" text.
  clientName?: string | null;
}

export default function ChecklistSection({
  bookingId,
  items,
  isLoading,
  bookingStatus,
  onToggle,
  onAddItem,
  isAddingItem = false,
  hideHeader = false,
  clientName = null,
}: ChecklistSectionProps) {
  const { handleChecklistAction, handleMarkDone, isActionPending } = useChecklistActions(bookingId);
  const [, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  // Per-section open state and add state, keyed by section key. Sections fall back to their default
  // open/closed until the musician toggles them; the addingKey holds whichever section is adding.
  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>({});
  const [addingKey, setAddingKey] = useState<string | null>(null);

  const shortcutHandlers: ChecklistShortcutHandlers = {
    onOpenCompose: (templateType?: string) => setSearchParams(templateType ? { sheet: 'compose', templateType } : { sheet: 'compose' }),
    onChecklistAction: handleChecklistAction,
    onMarkDone: handleMarkDone,
    onDeepLink: (section: string) => navigate(`/admin/bookings/${bookingId}/builder?section=${section}`),
    isActionPending,
  };

  if (isLoading) {
    return (
      <section>
        <div className="mb-3 h-4 w-20 animate-pulse rounded bg-border" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex animate-pulse items-center gap-2.5">
              <div className="h-4 w-4 flex-shrink-0 rounded-full bg-border" />
              <div className="h-3 flex-1 rounded bg-border" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  const sections = buildSections(items, bookingStatus);
  const autoOpenKey = defaultOpenStage(sections);
  const isOpen = (s: Section) =>
    s.key in openOverrides ? openOverrides[s.key] : s.relation === 'anytime' || s.key === autoOpenKey;

  return (
    <section>
      {!hideHeader && <h2 className="mb-1 text-sm font-semibold text-foreground">Checklist</h2>}

      <BookingConceptCardContainer />

      {sections.map((section) => (
        <StatusSection
          key={section.key}
          section={section}
          isOpen={isOpen(section)}
          onToggleOpen={() => setOpenOverrides((o) => ({ ...o, [section.key]: !isOpen(section) }))}
          handlers={shortcutHandlers}
          onSetState={onToggle}
          isAdding={addingKey === section.key}
          onStartAdd={() => setAddingKey(section.key)}
          onCancelAdd={() => setAddingKey(null)}
          onAddItem={(data) => {
            onAddItem(data);
            setAddingKey(null);
          }}
          isAddingItem={isAddingItem}
          clientName={clientName}
        />
      ))}
    </section>
  );
}
