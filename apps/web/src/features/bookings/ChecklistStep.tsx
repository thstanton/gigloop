import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';
import { PageSection } from '@/components/common/PageSection';
import { REMINDER_CONCERN_LABELS, REMINDER_CONCERN_ORDER } from '@/lib/constants';
import { RemindMeAbout, type ReminderRow } from './RemindMeAbout';
import type {
  ChecklistDefaultItem,
  ReminderConcern,
  ReminderPrerequisite,
  ReminderPreview,
} from '@/types/api';

// Step 2 of the New Booking wizard, rebuilt as the per-concern "Remind me about" controls so the
// create surface matches the Builder (#560, ADR-0052). Pre-creation there is no booking to seed
// against (atomic create, ADR-0047), so this is *selection-as-state*: every previewed reminder
// defaults on (will be seeded) and turning one off excludes it from the atomic create. Reminder
// rows + coaching come from the backend preview (no concern/hint/phrase maps duplicated here); the
// create payload is built from the full template defaults the form already holds, keyed by the
// user's selection.

type Stage = ChecklistDefaultItem['requiredForStatus'];

interface LocalCustom {
  id: string;
  label: string;
  requiredForStatus: Stage;
  concern: ReminderConcern | null;
}

// Join the in-scope prerequisite phrases the way the engine does, but gated by the *live* selection:
// a dependent's "after you …" clause names only the prerequisites the user is still choosing to seed
// (turning a prerequisite off drops it from its dependents' clauses). This is a plain string join —
// the phrases themselves are authored by the backend preview, so no phrase table is duplicated here.
function afterFromSelection(prerequisites: ReminderPrerequisite[], excluded: Set<string>): string | null {
  const phrases = prerequisites.filter((p) => !excluded.has(p.key)).map((p) => p.phrase);
  if (phrases.length === 0) return null;
  if (phrases.length === 1) return phrases[0];
  return `${phrases.slice(0, -1).join(', ')} and ${phrases[phrases.length - 1]}`;
}

interface Props {
  /** The system reminders to offer, grouped by concern (backend preview, stage-filtered). */
  preview: ReminderPreview[];
  isPreviewLoading: boolean;
  /** The user's full template defaults — the source for the create payload (keyed by selection). */
  checklistDefaults: ChecklistDefaultItem[];
  onBack: () => void;
  onCreate: (items: ChecklistDefaultItem[]) => void;
  isCreating: boolean;
  isError: boolean;
}

export function ChecklistStep({
  preview,
  isPreviewLoading,
  checklistDefaults,
  onBack,
  onCreate,
  isCreating,
  isError,
}: Props) {
  // `excluded` holds the system keys turned off; everything else is on (default-seeded). Customs are
  // held locally until the atomic create. A counter gives each local custom a stable row id.
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [customs, setCustoms] = useState<LocalCustom[]>([]);
  const customId = useRef(0);

  const toggleKey = (key: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const addCustom = (concern: ReminderConcern | null) => (label: string, requiredForStatus: Stage) => {
    customId.current += 1;
    setCustoms((prev) => [...prev, { id: `custom-${customId.current}`, label, requiredForStatus, concern }]);
    return Promise.resolve();
  };

  const removeCustom = (id: string) => setCustoms((prev) => prev.filter((c) => c.id !== id));

  // A previewed system reminder as the atom's row shape — on/after derived from the live selection.
  const systemRow = (r: ReminderPreview): ReminderRow => ({
    itemId: null,
    key: r.key,
    label: r.label,
    on: !excluded.has(r.key),
    source: 'system',
    state: null,
    requiredForStatus: r.requiredForStatus,
    autoCompleteHint: r.autoCompleteHint,
    after: afterFromSelection(r.prerequisites, excluded),
  });

  const customRow = (c: LocalCustom): ReminderRow => ({
    itemId: c.id,
    key: null,
    label: c.label,
    on: true,
    source: 'custom',
    state: null,
    requiredForStatus: c.requiredForStatus,
    autoCompleteHint: null,
    after: null,
  });

  // A system row toggles its selection (stays shown, off, re-addable); a locally-added custom has no
  // record to keep as an off state, so toggling it off removes it.
  const onToggle = (r: ReminderRow) => {
    if (r.key) toggleKey(r.key);
    else if (r.itemId) removeCustom(r.itemId);
  };

  function handleCreate() {
    const previewKeys = new Set(preview.map((r) => r.key));
    // System items: the template default for each in-scope, still-selected key. The preview is for
    // display only — the seed payload comes from the defaults the form already holds. Each is mapped
    // to the exact create-DTO shape (dropping the template-only `enabled` flag, which the booking
    // checklist input does not accept and would reject under forbidNonWhitelisted).
    const systemItems: ChecklistDefaultItem[] = checklistDefaults
      .filter((d) => d.key != null && previewKeys.has(d.key) && !excluded.has(d.key))
      .map((d) => ({
        key: d.key,
        label: d.label,
        completedBy: d.completedBy,
        dependsOn: d.dependsOn,
        autoCompleteRule: d.autoCompleteRule,
        requiredForStatus: d.requiredForStatus,
        dueDateRule: d.dueDateRule,
      }));
    const customItems: ChecklistDefaultItem[] = customs.map((c) => ({
      key: null,
      label: c.label,
      completedBy: 'USER',
      dependsOn: [],
      autoCompleteRule: null,
      requiredForStatus: c.requiredForStatus,
      dueDateRule: null,
      concern: c.concern,
    }));
    onCreate([...systemItems, ...customItems]);
  }

  const byConcern = REMINDER_CONCERN_ORDER.map((concern) => ({
    concern,
    rows: [
      ...preview.filter((r) => r.concern === concern).map(systemRow),
      ...customs.filter((c) => c.concern === concern).map(customRow),
    ],
  }));
  const otherItems = customs.filter((c) => c.concern === null).map(customRow);

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto">
      <PageHeader title="Reminders" onBack={onBack} backLabel="Back" />
      <p className="text-sm text-muted -mt-4 mb-6">
        Choose what GigMan reminds you about for this booking. Everything's on by default — turn off
        anything you don't need. You can change these any time on the booking.
      </p>

      {isPreviewLoading ? (
        <p className="text-sm text-muted mb-6">Loading reminders…</p>
      ) : (
        <div className="space-y-8 mb-8">
          {byConcern.map(({ concern, rows }) => (
            <section key={concern} aria-label={REMINDER_CONCERN_LABELS[concern]}>
              <PageSection title={REMINDER_CONCERN_LABELS[concern]} className="mb-3" />
              <RemindMeAbout reminders={rows} onToggle={onToggle} onAdd={addCustom(concern)} />
            </section>
          ))}
          <section aria-label="Other items">
            <PageSection
              title="Other items"
              description="Anything else you want to remember for this gig."
              className="mb-3"
            />
            <RemindMeAbout reminders={otherItems} onToggle={onToggle} onAdd={addCustom(null)} />
          </section>
        </div>
      )}

      {isError && (
        <p className="text-sm text-status-cancelled mb-4">Failed to create booking. Please try again.</p>
      )}

      <div className="flex gap-3">
        <Button onClick={handleCreate} disabled={isCreating || isPreviewLoading}>
          {isCreating ? 'Creating…' : 'Create booking'}
        </Button>
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}
