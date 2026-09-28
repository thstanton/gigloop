import { BAND_CHECKLIST_GOAL_KEY, CHECKLIST_DEFAULTS } from './checklist-defaults';
import { planBandGoalReset, planBandMemberStepSync } from './checklist-band-steps';

const templates = CHECKLIST_DEFAULTS.find((item) => item.key === BAND_CHECKLIST_GOAL_KEY)!.steps!;
const stamp = new Date('2026-09-01T00:00:00.000Z');

function goal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'goal-1',
    userId: 'user-1',
    state: 'PENDING',
    steps: [],
    ...overrides,
  };
}

function member(overrides: Record<string, unknown> = {}) {
  return {
    id: 'member-1',
    status: 'ADDED',
    isSelf: false,
    createdAt: stamp,
    contact: { name: 'Dave' },
    ...overrides,
  };
}

describe('planBandMemberStepSync (#900)', () => {
  it('creates a named pair for eligible members, not self or a first-seen decline', () => {
    const plan = planBandMemberStepSync(
      goal(),
      [
        member({ id: 'member-1', status: 'ADDED', contact: { name: 'Dave' } }),
        member({ id: 'member-self', isSelf: true, contact: { name: 'Tim' } }),
        member({ id: 'member-declined', status: 'DECLINED', contact: { name: 'Jo' } }),
      ],
      templates,
    );

    expect(plan).toMatchObject({ deleteStepIds: [], updateSteps: [] });
    expect(plan.createSteps.map(({ template, memberId, label, order }) => ({
      key: template.key,
      memberId,
      label,
      order,
    }))).toEqual([
      { key: 'invite_band_member', memberId: 'member-1', label: 'Invite Dave', order: 3 },
      { key: 'band_member_confirmed', memberId: 'member-1', label: 'Dave confirms', order: 4 },
    ]);
  });

  it('keeps a declined member’s existing pair but removes self and removed-member steps', () => {
    const plan = planBandMemberStepSync(
      goal({
        steps: [
          { id: 'd-invite', key: 'invite_band_member', bandMemberId: 'member-dave', label: 'Invite Dave', order: 3, state: 'COMPLETE' },
          { id: 'd-confirm', key: 'band_member_confirmed', bandMemberId: 'member-dave', label: 'Dave confirms', order: 4, state: 'DECLINED' },
          { id: 'self-invite', key: 'invite_band_member', bandMemberId: 'member-self', label: 'Invite Tim', order: 5, state: 'PENDING' },
          { id: 'removed-confirm', key: 'band_member_confirmed', bandMemberId: 'member-removed', label: 'Jo confirms', order: 6, state: 'PENDING' },
        ],
      }),
      [
        member({ id: 'member-dave', status: 'DECLINED', contact: { name: 'Dave' } }),
        member({ id: 'member-self', isSelf: true, contact: { name: 'Tim' } }),
      ],
      templates,
    );

    expect(plan.createSteps).toEqual([]);
    expect(plan.updateSteps).toEqual([]);
    expect(plan.deleteStepIds).toEqual(['self-invite', 'removed-confirm']);
  });

  it('is idempotent when rows already match their template', () => {
    const plan = planBandMemberStepSync(
      goal({
        steps: [
          { id: 'invite', key: 'invite_band_member', bandMemberId: 'member-1', label: 'Invite Dave', order: 3, state: 'COMPLETE' },
          { id: 'confirm', key: 'band_member_confirmed', bandMemberId: 'member-1', label: 'Dave confirms', order: 4, state: 'PENDING' },
        ],
      }),
      [member()],
      templates,
    );

    expect(plan).toEqual({ deleteStepIds: [], createSteps: [], updateSteps: [] });
  });
});

describe('planBandGoalReset (#900)', () => {
  it('reopens a completed goal, both readiness preconditions, and the changed member confirmation', () => {
    const plan = planBandGoalReset(
      goal({
        state: 'COMPLETE',
        steps: [
          { id: 'choose', key: 'choose_a_lineup', state: 'COMPLETE', bandMemberId: null },
          { id: 'fill', key: 'fill_every_chair', state: 'COMPLETE', bandMemberId: null },
          { id: 'invite-dave', key: 'invite_band_member', state: 'COMPLETE', bandMemberId: 'member-1' },
          { id: 'dave', key: 'band_member_confirmed', state: 'COMPLETE', bandMemberId: 'member-1' },
          { id: 'sam', key: 'band_member_confirmed', state: 'COMPLETE', bandMemberId: 'member-2' },
          { id: 'history', key: 'band_member_confirmed', state: 'DECLINED', bandMemberId: 'member-3' },
        ],
      }),
      'member-1',
    );

    expect(plan).toEqual({ resetGoal: true, resetStepIds: ['choose', 'fill', 'invite-dave', 'dave'] });
  });

  it('leaves skipped goals and declined history alone', () => {
    const plan = planBandGoalReset(
      goal({
        state: 'SKIPPED',
        steps: [{ id: 'declined', key: 'band_member_confirmed', state: 'DECLINED', bandMemberId: 'member-1' }],
      }),
      'member-1',
    );

    expect(plan).toEqual({ resetGoal: false, resetStepIds: [] });
  });
});
