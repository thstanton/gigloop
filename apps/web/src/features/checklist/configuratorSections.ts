import { statusBefore } from '@/lib/constants';
import type { BookingStatus, ChecklistDefaultItem, ChecklistDefaultStep, DueDateRule } from '@/types/api';

// The Settings configurator's grouping — the pure, unit-tested seam (#620 story 16 / #718). Given the
// fetched checklist defaults (system goals + custom items, already merged with saved overrides by the
// backend), derive the per-stage sections the goal-world UI renders. Grouping mirrors the live
// ChecklistSection and the onboarding step: a goal is worked in the stage BEFORE its `requiredForStatus`
// (its "bracket", via `statusBefore`), and a stage-less item lives in the always-present "Anytime"
// section. Presentation overlays (GOAL_SUMMARIES copy, song-form gating, stage labels/colours) stay in
// the component — this helper is copy-free so its output is a stable structural contract to test.

// The four brackets a goal can be worked in, in lifecycle order. No COMPLETE bracket: nothing is worked
// during the terminal stage (`statusBefore` never returns COMPLETE), matching the live section.
const CONFIGURATOR_BRACKETS: BookingStatus[] = ['ENQUIRY', 'PROVISIONAL', 'CONFIRMED', 'READY'];
export const ANYTIME_STAGE = 'anytime' as const;
export type ConfiguratorStage = BookingStatus | typeof ANYTIME_STAGE;

// A system goal row. `steps` is the ordered read-only step list (precondition + milestone, catalogue
// order) previewed under the goal; empty for an atomic goal, which shows no disclosure.
export interface ConfiguratorGoalRow {
  key: string;
  label: string;
  enabled: boolean;
  dueDateRule: DueDateRule | null;
  steps: ChecklistDefaultStep[];
  isMultiStep: boolean;
}

// A custom (user-authored) row. `index` is its position in the source array — the stable identity the
// component uses to edit/remove it (custom items have no key).
export interface ConfiguratorCustomRow {
  index: number;
  label: string;
  enabled: boolean;
  dueDateRule: DueDateRule | null;
  concern: string | null;
}

export interface ConfiguratorSection {
  stage: ConfiguratorStage;
  goals: ConfiguratorGoalRow[];
  customs: ConfiguratorCustomRow[];
}

// The bracket an item is worked in: the stage before its target gate, or "anytime" if it gates nothing.
function bracketOf(item: ChecklistDefaultItem): ConfiguratorStage {
  return item.requiredForStatus ? (statusBefore(item.requiredForStatus) ?? ANYTIME_STAGE) : ANYTIME_STAGE;
}

/**
 * Derive the configurator's grouped sections from the fetched (and locally-edited) defaults array.
 * Returns the four bracket sections plus "Anytime", always all five and in order, so the component can
 * render a card per stage (an empty section shows its empty state). System goals (`key != null`) and
 * custom items (`key == null`) are split within each section; `enabled` is read straight off the item
 * (the backend already folded any saved override in). Custom rows carry their source-array index for
 * stable edit/remove identity.
 */
export function buildConfiguratorSections(defaults: ChecklistDefaultItem[]): ConfiguratorSection[] {
  const goalsByStage = new Map<ConfiguratorStage, ConfiguratorGoalRow[]>();
  const customsByStage = new Map<ConfiguratorStage, ConfiguratorCustomRow[]>();

  defaults.forEach((item, index) => {
    const stage = bracketOf(item);
    if (item.key == null) {
      const rows = customsByStage.get(stage) ?? [];
      rows.push({
        index,
        label: item.label,
        enabled: item.enabled !== false,
        dueDateRule: item.dueDateRule ?? null,
        concern: item.concern ?? null,
      });
      customsByStage.set(stage, rows);
    } else {
      const steps = item.steps ?? [];
      const rows = goalsByStage.get(stage) ?? [];
      rows.push({
        key: item.key,
        label: item.label,
        enabled: item.enabled !== false,
        dueDateRule: item.dueDateRule ?? null,
        steps,
        isMultiStep: steps.length > 0,
      });
      goalsByStage.set(stage, rows);
    }
  });

  const order: ConfiguratorStage[] = [...CONFIGURATOR_BRACKETS, ANYTIME_STAGE];
  return order.map((stage) => ({
    stage,
    goals: goalsByStage.get(stage) ?? [],
    customs: customsByStage.get(stage) ?? [],
  }));
}
