import type { ChecklistDefaultStep } from './checklist-defaults';

export interface BandChecklistMember {
  id: string;
  status: string;
  isSelf: boolean;
  contactId: string;
  createdAt: Date;
  contact: { name: string };
}

export interface BandChecklistChair {
  memberId: string | null;
  memberStatus: string | null;
}

export interface BandChecklistStepRow {
  id: string;
  key: string | null;
  bandMemberId: string | null;
  label: string;
  order: number;
  state: string;
}

export interface BandChecklistGoal {
  id: string;
  key: string | null;
  userId: string;
  state: string;
  steps: BandChecklistStepRow[];
}

export interface BandChecklistStepSyncData {
  goals: BandChecklistGoal[];
  members: BandChecklistMember[];
  chairs: BandChecklistChair[];
}

export interface BandMemberStepCreation {
  template: ChecklistDefaultStep;
  memberId: string;
  label: string;
  order: number;
}

export interface BandMemberStepUpdate {
  id: string;
  label: string;
  order: number;
}

export interface BandMemberStepSyncPlan {
  deleteStepIds: string[];
  createSteps: BandMemberStepCreation[];
  updateSteps: BandMemberStepUpdate[];
  // A COMPLETE goal is terminal to the evaluator, so a newly rostered member's row must
  // re-open it or the new step would never be rolled up.
  reopenGoal: boolean;
}

export interface BandGoalResetPlan {
  resetGoal: boolean;
  resetStepIds: string[];
}

/** Steps with persistent rows at goal creation (per-member templates wait for a roster row). */
export function seedableChecklistSteps(steps: ChecklistDefaultStep[]): ChecklistDefaultStep[] {
  return steps.filter((step) => !step.perBandMember);
}

/** Pure roster-to-step reconciliation; persistence is owned by ChecklistRepository. */
export function planBandMemberStepSync(
  goal: BandChecklistGoal,
  members: BandChecklistMember[],
  templateSteps: ChecklistDefaultStep[],
): BandMemberStepSyncPlan {
  const templates = templateSteps.filter((step) => step.perBandMember);
  const templateKeys = new Set(templates.map((step) => step.key));
  const existingRows = goal.steps.filter(
    (step) => step.bandMemberId !== null && templateKeys.has(step.key ?? ''),
  );
  const existingMemberIds = new Set(existingRows.map((step) => step.bandMemberId as string));
  // A goal's member rows share one decline policy (the confirmation pair together, or the brief alone).
  const keepsDeclinedHistory = templates.every((step) => step.keepsDeclinedHistory === true);
  const eligible = [...members]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
    .filter((member) => !member.isSelf && (
      member.status !== 'DECLINED' || (keepsDeclinedHistory && existingMemberIds.has(member.id))
    ));
  const retainedIds = new Set(eligible.map((member) => member.id));
  const firstDynamicOrder = templateSteps.findIndex((step) => step.perBandMember) + 1;
  const existingByMemberAndKey = new Map(
    existingRows.map((step) => [`${step.bandMemberId}:${step.key}`, step]),
  );
  const createSteps: BandMemberStepCreation[] = [];
  const updateSteps: BandMemberStepUpdate[] = [];

  eligible.forEach((member, memberIndex) => {
    templates.forEach((template, templateIndex) => {
      const label = (template.memberLabel ?? template.label).replace('{name}', member.contact.name);
      const order = firstDynamicOrder + memberIndex * templates.length + templateIndex;
      const existing = existingByMemberAndKey.get(`${member.id}:${template.key}`);
      if (existing) {
        if (existing.label !== label || existing.order !== order) {
          updateSteps.push({ id: existing.id, label, order });
        }
        return;
      }
      createSteps.push({ template, memberId: member.id, label, order });
    });
  });

  return {
    deleteStepIds: existingRows
      .filter((step) => !retainedIds.has(step.bandMemberId as string))
      .map((step) => step.id),
    createSteps,
    updateSteps,
    reopenGoal: goal.state === 'COMPLETE' && createSteps.length > 0,
  };
}

/** The sticky rows that a roster mutation must unstick before the evaluator runs. */
export function planBandGoalReset(goal: BandChecklistGoal, memberId?: string): BandGoalResetPlan {
  const isRosterPrecondition = (key: string | null) =>
    key === 'choose_a_lineup' || key === 'fill_every_chair';
  const isMemberStep = (step: BandChecklistStepRow) =>
    memberId !== undefined &&
    step.bandMemberId === memberId &&
    (step.key === 'invite_band_member' || step.key === 'band_member_confirmed');

  return {
    resetGoal: goal.state === 'COMPLETE',
    resetStepIds: goal.steps
      .filter((step) => step.state === 'COMPLETE' && (isRosterPrecondition(step.key) || isMemberStep(step)))
      .map((step) => step.id),
  };
}
