import { ChecklistDefaultItem } from '../bookings/checklist-defaults';
import {
  FlatChecklistItem,
  planGoalMigration,
  planTemplateMigration,
} from './checklist-goal-migration';

// A flat checklist item as the migration reads it. Defaults keep the test terse.
function flat(overrides: Partial<FlatChecklistItem> & { key: string | null }): FlatChecklistItem {
  return {
    id: overrides.id ?? `id-${overrides.key}`,
    key: overrides.key,
    state: overrides.state ?? 'PENDING',
    completedAt: overrides.completedAt ?? null,
    dueDate: overrides.dueDate ?? null,
    order: overrides.order ?? 1,
  };
}

const stepKeys = (steps: { key: string }[]) => steps.map((s) => s.key);

describe('planGoalMigration — deposit (get_deposit_paid, ADR-0057 / #608, fixes #585)', () => {
  it('collapses the flat deposit cluster into the goal + canonical issue→send→received spine', () => {
    const items = [
      flat({ id: 'cdi', key: 'create_deposit_invoice', state: 'COMPLETE', completedAt: new Date('2026-01-01'), order: 3 }),
      flat({ id: 'dr', key: 'deposit_received', state: 'PENDING', order: 5, dueDate: new Date('2026-08-01') }),
    ];

    const plan = planGoalMigration(items, 'get_deposit_paid')!;

    expect(plan.goal).toMatchObject({
      key: 'get_deposit_paid',
      completedBy: 'USER',
      requiredForStatus: 'CONFIRMED',
      autoCompleteRule: null,
      order: 3, // lowest order of the cluster
    });
    expect(stepKeys(plan.steps)).toEqual([
      'create_deposit_invoice',
      'send_deposit_invoice',
      'deposit_received',
    ]);
    expect([...plan.deleteIds].sort((a, b) => a.localeCompare(b))).toEqual(['cdi', 'dr']);
  });

  it('seeds the new send_deposit_invoice step as PENDING while later steps are outstanding', () => {
    // The send step is new in #608 — no old flat item carries its state. While nothing after it is
    // COMPLETE it migrates PENDING (the post-migration evaluate() then auto-completes it if the
    // deposit email was already sent).
    const items = [
      flat({ key: 'create_deposit_invoice', state: 'COMPLETE', completedAt: new Date('2026-01-01') }),
      flat({ key: 'deposit_received', state: 'PENDING' }),
    ];
    const plan = planGoalMigration(items, 'get_deposit_paid')!;
    const send = plan.steps.find((s) => s.key === 'send_deposit_invoice')!;
    expect(send).toMatchObject({ state: 'PENDING', completeMode: 'ACTION', completedAt: null });
    expect(plan.goal.state).toBe('PENDING');
  });

  it('back-fills the new send step to COMPLETE for an already-received deposit (Story 21, no nag)', () => {
    // A booking whose deposit was already received — possibly paid in cash with NO email record —
    // must not migrate to a goal nagging "Send deposit invoice". The monotonic milestone spine
    // back-fills the inserted send step from the COMPLETE received step, so the goal reads COMPLETE.
    const items = [
      flat({ key: 'create_deposit_invoice', state: 'COMPLETE', completedAt: new Date('2026-01-01') }),
      flat({ key: 'deposit_received', state: 'COMPLETE', completedAt: new Date('2026-02-01') }),
    ];
    const plan = planGoalMigration(items, 'get_deposit_paid')!;
    expect(plan.steps.find((s) => s.key === 'send_deposit_invoice')!.state).toBe('COMPLETE');
    expect(plan.goal.state).toBe('COMPLETE');
    // Goal completedAt is the latest real step completion (the received date), not the back-fill.
    expect(plan.goal.completedAt).toEqual(new Date('2026-02-01'));
  });

  it('does not back-fill past a FAILED step (a bounced send is a real surfaced state)', () => {
    const items = [
      flat({ key: 'create_deposit_invoice', state: 'FAILED' }),
      flat({ key: 'deposit_received', state: 'COMPLETE', completedAt: new Date('2026-02-01') }),
    ];
    const plan = planGoalMigration(items, 'get_deposit_paid')!;
    // send_deposit_invoice (between FAILED create and COMPLETE received) still back-fills, but the
    // FAILED step stays FAILED → the goal rolls up FAILED, not COMPLETE.
    expect(plan.steps.find((s) => s.key === 'create_deposit_invoice')!.state).toBe('FAILED');
    expect(plan.goal.state).toBe('FAILED');
  });

  it('carries the earliest cluster due date onto the goal (the surfacing anchor)', () => {
    const due = new Date('2026-08-01');
    const items = [
      flat({ key: 'create_deposit_invoice', state: 'PENDING' }), // no due date
      flat({ key: 'deposit_received', state: 'PENDING', dueDate: due }),
    ];
    expect(planGoalMigration(items, 'get_deposit_paid')!.goal.dueDate).toEqual(due);
  });

  it('is idempotent — returns null when the goal already exists', () => {
    const items = [
      flat({ key: 'get_deposit_paid', state: 'PENDING' }),
      flat({ key: 'create_deposit_invoice', state: 'COMPLETE' }), // a stray leftover must not re-trigger
    ];
    expect(planGoalMigration(items, 'get_deposit_paid')).toBeNull();
  });
});

describe('planGoalMigration — balance (invoice_the_balance, ADR-0057 / #608)', () => {
  it('collapses the issue→send cluster and rolls up COMPLETE with the latest completion', () => {
    const items = [
      flat({ id: 'cbi', key: 'create_balance_invoice', state: 'COMPLETE', completedAt: new Date('2026-03-01'), order: 8 }),
      flat({ id: 'sbi', key: 'send_balance_invoice', state: 'COMPLETE', completedAt: new Date('2026-03-03'), order: 9 }),
    ];
    const plan = planGoalMigration(items, 'invoice_the_balance')!;
    expect(stepKeys(plan.steps)).toEqual(['create_balance_invoice', 'send_balance_invoice']);
    expect(plan.goal.state).toBe('COMPLETE');
    expect(plan.goal.completedAt).toEqual(new Date('2026-03-03'));
    expect([...plan.deleteIds].sort((a, b) => a.localeCompare(b))).toEqual(['cbi', 'sbi']);
  });

  it('rolls up to FAILED when a flat item is FAILED (bounced send)', () => {
    const items = [
      flat({ key: 'create_balance_invoice', state: 'COMPLETE', completedAt: new Date('2026-03-01') }),
      flat({ key: 'send_balance_invoice', state: 'FAILED' }),
    ];
    expect(planGoalMigration(items, 'invoice_the_balance')!.goal.state).toBe('FAILED');
  });
});

describe('planGoalMigration — song requests (gather_song_requests, ADR-0057 / #608)', () => {
  it('collapses invite→response and normalises BLOCKED/SKIPPED flat states to PENDING steps', () => {
    const items = [
      flat({ key: 'music_form_invite', state: 'BLOCKED' }),
      flat({ key: 'song_requests', state: 'SKIPPED' }),
    ];
    const plan = planGoalMigration(items, 'gather_song_requests')!;
    expect(stepKeys(plan.steps)).toEqual(['music_form_invite', 'song_requests']);
    expect(plan.steps.find((s) => s.key === 'music_form_invite')!.state).toBe('PENDING');
    expect(plan.steps.find((s) => s.key === 'song_requests')!.state).toBe('PENDING');
    const response = plan.steps.find((s) => s.key === 'song_requests')!;
    expect(response).toMatchObject({ completeMode: 'AWAITED', completedBy: 'CUSTOMER' });
  });

  it('yields the full canonical spine from a partial cluster (only the invite present)', () => {
    const items = [flat({ id: 'mfi', key: 'music_form_invite', state: 'COMPLETE', completedAt: new Date('2026-04-01') })];
    const plan = planGoalMigration(items, 'gather_song_requests')!;
    expect(stepKeys(plan.steps)).toEqual(['music_form_invite', 'song_requests']);
    expect(plan.steps.find((s) => s.key === 'song_requests')!.state).toBe('PENDING');
    expect(plan.deleteIds).toEqual(['mfi']);
  });

  it('returns null when there is no cluster to collapse', () => {
    const items = [flat({ key: 'send_quote', state: 'COMPLETE' }), flat({ key: 'play_the_gig', state: 'PENDING' })];
    expect(planGoalMigration(items, 'gather_song_requests')).toBeNull();
  });

  it('names only the cluster in deleteIds, leaving unrelated items untouched', () => {
    const items = [
      flat({ id: 'sq', key: 'send_quote', state: 'COMPLETE' }),
      flat({ id: 'mfi', key: 'music_form_invite', state: 'PENDING' }),
      flat({ id: 'sr', key: 'song_requests', state: 'PENDING' }),
    ];
    expect([...planGoalMigration(items, 'gather_song_requests')!.deleteIds].sort((a, b) => a.localeCompare(b))).toEqual([
      'mfi',
      'sr',
    ]);
  });
});

describe('planTemplateMigration (saved checklist template, #608 AC1)', () => {
  const tmpl = (key: string | null, extra: Partial<ChecklistDefaultItem> = {}): ChecklistDefaultItem => ({
    key: key as string,
    label: key ?? 'Custom',
    completedBy: 'USER',
    dependsOn: [],
    autoCompleteRule: null,
    requiredForStatus: 'READY',
    dueDateRule: null,
    ...extra,
  });

  const GOAL_KEYS = ['get_deposit_paid', 'invoice_the_balance', 'gather_song_requests'];

  it('collapses all three clusters into their canonical goals in place', () => {
    const stored = [
      tmpl('send_quote', { requiredForStatus: 'PROVISIONAL' }),
      tmpl('create_deposit_invoice', { requiredForStatus: 'CONFIRMED' }),
      tmpl('deposit_received', { requiredForStatus: 'CONFIRMED' }),
      tmpl('create_balance_invoice'),
      tmpl('send_balance_invoice'),
      tmpl('music_form_invite'),
      tmpl('song_requests'),
      tmpl('play_the_gig', { requiredForStatus: 'COMPLETE' }),
    ];

    const next = planTemplateMigration(stored, GOAL_KEYS)!;

    expect(next.map((d) => d.key)).toEqual([
      'send_quote',
      'get_deposit_paid',
      'invoice_the_balance',
      'gather_song_requests',
      'play_the_gig',
    ]);
    const deposit = next.find((d) => d.key === 'get_deposit_paid')!;
    expect(deposit.steps?.map((s) => s.key)).toEqual([
      'create_deposit_invoice',
      'send_deposit_invoice',
      'deposit_received',
    ]);
    expect(deposit.autoCompleteRule).toBeNull();
  });

  it('preserves the user’s other overrides and custom items', () => {
    const stored = [
      tmpl('send_quote', { enabled: false }),
      tmpl('create_balance_invoice'),
      tmpl('send_balance_invoice'),
      tmpl(null, { label: 'Bring spare strings', concern: null }),
    ];

    const next = planTemplateMigration(stored, GOAL_KEYS)!;

    expect(next.find((d) => d.key === 'send_quote')!.enabled).toBe(false);
    expect(next.some((d) => d.label === 'Bring spare strings')).toBe(true);
    expect(next.some((d) => d.key === 'invoice_the_balance')).toBe(true);
  });

  it('returns null when the template has no old cluster keys (current or empty)', () => {
    expect(
      planTemplateMigration([tmpl('send_quote'), tmpl('get_deposit_paid')], GOAL_KEYS),
    ).toBeNull();
    expect(planTemplateMigration([], GOAL_KEYS)).toBeNull();
  });
});
