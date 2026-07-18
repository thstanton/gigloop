import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GhostButton } from '@/components/common/GhostButton';
import { apiPatch } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import {
  BOOKING_STATUS_LABELS,
  STATUS_DESCRIPTIONS,
  STATUS_ACCENT_BG,
  GOAL_SUMMARIES,
  MUSIC_FORM_GATED_CHECKLIST_KEYS,
} from '@/lib/constants';
import { StageCard } from './StageCard';
import {
  buildConfiguratorSections,
  ANYTIME_STAGE,
  type ConfiguratorStage,
} from './configuratorSections';
import { SystemGoalRow, CustomRow, CustomItemForm, type CustomFormData } from './ChecklistConfiguratorRows';
import type {
  UserProfile,
  UserPreferences,
  ChecklistDefaultItem,
  BookingStatus,
} from '@/types/api';

// A custom added under a stage card is worked *in* that stage, so it is required for the NEXT gate
// (its target `requiredForStatus`), mirroring the live ChecklistSection's bracket → target map. The
// "Anytime" card has no gate. The Enquiry bracket targets PROVISIONAL — the write DTO admits it (#718).
const STAGE_TO_TARGET: Record<string, ChecklistDefaultItem['requiredForStatus']> = {
  ENQUIRY: 'PROVISIONAL',
  PROVISIONAL: 'CONFIRMED',
  CONFIRMED: 'READY',
  READY: 'COMPLETE',
};

// Enforce the booking-created after-only invariant (#718) on a seeded item: a `bookingCreation` rule
// with a negative offset (a reminder before the record existed) is impossible, so anchor it to
// creation (offset 0). No-op for every valid rule.
function normalizeDueDate(item: ChecklistDefaultItem): ChecklistDefaultItem {
  const rule = item.dueDateRule;
  const beforeCreation = rule?.basis === 'bookingCreation' && rule.offsetDays < 0;
  return beforeCreation ? { ...item, dueDateRule: { ...rule!, offsetDays: 0 } } : item;
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
      {isError && !isPending && <span className="text-sm text-status-cancelled">Something went wrong</span>}
    </div>
  );
}

/**
 * The Settings "Checklist" configurator, in goal-world (#620 / #718). Presents each system goal as the
 * outcome it represents — enable/disable, a goal-level due date, and a collapsed read-only preview of
 * the steps GigLoop runs — grouped into per-stage cards (the shared StageCard shell), plus the
 * musician's own custom reminders. Presentation-only on the read path; the save contract (system
 * overrides keyed by goal + custom items) is unchanged, and step/precondition sequencing is never
 * written from here. `songFormEnabled` (lifted from the General subsection) gates the music goal.
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

  // One working array — system goals (key != null) and custom items (key == null) together, seeded
  // once from the fetched defaults (which the backend already merged with saved overrides, #615). No
  // resync effect: a background ['me'] refetch can't wipe unsaved edits, and after a save the working
  // values already match what was persisted. Legacy `bookingCreation` + before-offset rules (the old
  // flat editor let anchor and direction vary independently) are now invalid (#718: booking-created is
  // after-only). Normalise them on seed to "on creation" so they surface as a valid value the user can
  // see and re-set — rather than the write DTO 400ing an untouched rule when another goal is saved.
  const [working, setWorking] = useState<ChecklistDefaultItem[]>(() => savedDefaults.map(normalizeDueDate));
  const [addingStage, setAddingStage] = useState<ConfiguratorStage | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  const sections = useMemo(() => buildConfiguratorSections(working), [working]);

  const setGoal = (key: string, patch: Partial<ChecklistDefaultItem>) =>
    setWorking((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const addCustom = (stage: ConfiguratorStage, data: CustomFormData) => {
    const requiredForStatus = stage === ANYTIME_STAGE ? null : STAGE_TO_TARGET[stage] ?? null;
    setWorking((prev) => [
      ...prev,
      {
        key: null,
        label: data.label,
        // #718: completedBy is not meaningfully implemented until band-members; always the user.
        completedBy: 'USER',
        autoCompleteRule: null,
        requiredForStatus,
        dueDateRule: data.dueDateRule,
        concern: data.concern,
      },
    ]);
    setAddingStage(null);
  };

  const editCustom = (index: number, data: CustomFormData) => {
    setWorking((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, label: data.label, concern: data.concern, dueDateRule: data.dueDateRule } : item,
      ),
    );
    setEditingIndex(null);
  };

  const deleteCustom = (index: number) => {
    setWorking((prev) => prev.filter((_, i) => i !== index));
    // The array reindexes on removal — always clear edit state so a shifted index can't edit a row.
    setEditingIndex(null);
    setAddingStage(null);
  };

  const mutation = useMutation({
    mutationFn: () =>
      apiPatch<UserProfile>('/me/preferences/checklist-defaults', {
        systemItemOverrides: working
          .filter((item): item is ChecklistDefaultItem & { key: string } => item.key != null)
          .map((item) => ({
            key: item.key,
            enabled: item.enabled !== false,
            dueDateRule: item.dueDateRule ?? null,
          })),
        customItems: working
          .filter((item) => item.key == null)
          .map((item) => ({
            label: item.label,
            completedBy: 'USER' as const,
            requiredForStatus: item.requiredForStatus ?? null,
            concern: item.concern ?? null,
            dueDateRule: item.dueDateRule ?? null,
          })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: () => toast({ title: 'Failed to save checklist defaults', variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        This is your master checklist — the reminders GigLoop seeds on <span className="text-foreground">every new booking</span>.
        Switch a goal off to stop seeding it, and set when each is due. You can still fine-tune reminders on an
        individual booking from its own “Remind me about” controls.
      </p>

      {sections.map((section) => {
        const isAnytime = section.stage === ANYTIME_STAGE;
        const label = isAnytime ? 'Anytime' : BOOKING_STATUS_LABELS[section.stage as BookingStatus];
        const description = isAnytime
          ? 'Your own reminders that aren’t tied to a stage — they appear on every booking.'
          : STATUS_DESCRIPTIONS[section.stage as BookingStatus];
        const accentClass = isAnytime ? undefined : STATUS_ACCENT_BG[section.stage as BookingStatus];
        const hasRows = section.goals.length > 0 || section.customs.length > 0;

        return (
          <StageCard key={section.stage} label={label} description={description} accentClass={accentClass}>
            {hasRows && (
              <div className="divide-y divide-border">
                {section.goals.map((goal) => {
                  const gated = MUSIC_FORM_GATED_CHECKLIST_KEYS.includes(goal.key) && !songFormEnabled;
                  return (
                    <SystemGoalRow
                      key={goal.key}
                      label={goal.label}
                      summary={GOAL_SUMMARIES[goal.key]}
                      enabled={goal.enabled}
                      gated={gated}
                      dueDateRule={goal.dueDateRule}
                      steps={goal.steps}
                      onToggle={(v) => setGoal(goal.key, { enabled: v })}
                      onDueDateChange={(rule) => setGoal(goal.key, { dueDateRule: rule })}
                    />
                  );
                })}
                {section.customs.map((custom) =>
                  editingIndex === custom.index ? (
                    <div key={custom.index} className="px-4 py-3">
                      <CustomItemForm
                        initial={{
                          label: custom.label,
                          concern: (custom.concern as CustomFormData['concern']) ?? null,
                          dueDateRule: custom.dueDateRule,
                        }}
                        onSave={(data) => editCustom(custom.index, data)}
                        onCancel={() => setEditingIndex(null)}
                        onDelete={() => deleteCustom(custom.index)}
                      />
                    </div>
                  ) : (
                    <CustomRow
                      key={custom.index}
                      label={custom.label}
                      concern={custom.concern}
                      dueDateRule={custom.dueDateRule}
                      onEdit={() => {
                        setAddingStage(null);
                        setEditingIndex(custom.index);
                      }}
                      onDelete={() => deleteCustom(custom.index)}
                    />
                  ),
                )}
              </div>
            )}

            <div className={hasRows ? 'px-4 py-3 border-t border-border' : 'px-4 py-3'}>
              {addingStage === section.stage ? (
                <CustomItemForm
                  onSave={(data) => addCustom(section.stage, data)}
                  onCancel={() => setAddingStage(null)}
                />
              ) : (
                <GhostButton
                  onClick={() => {
                    setEditingIndex(null);
                    setAddingStage(section.stage);
                  }}
                  variant="primary"
                  size="xs"
                  icon={<Plus size={12} />}
                >
                  Add your own reminder
                </GhostButton>
              )}
            </div>
          </StageCard>
        );
      })}

      <SaveBar
        isPending={mutation.isPending}
        saved={saved}
        isError={mutation.isError}
        onSave={() => mutation.mutate()}
      />
    </div>
  );
}
