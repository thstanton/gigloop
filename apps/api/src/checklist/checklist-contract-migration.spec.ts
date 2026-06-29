import { ChecklistDefaultItem } from '../bookings/checklist-defaults';
import {
  FlatChecklistItem,
  planContractMigration,
  planTemplateMigration,
} from './checklist-contract-migration';

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

const stepKey = (steps: { key: string }[]) => steps.map((s) => s.key);

describe('planContractMigration (ADR-0057 / #607 data migration)', () => {
  it('collapses the flat cluster into one get_contract_signed goal + the canonical 3-step spine', () => {
    const items = [
      flat({ id: 'cc', key: 'create_contract', state: 'COMPLETE', completedAt: new Date('2026-01-01'), order: 4 }),
      flat({ id: 'sc', key: 'send_contract', state: 'COMPLETE', completedAt: new Date('2026-01-02'), order: 5, dueDate: new Date('2026-08-01') }),
      flat({ id: 'cs', key: 'contract_signed', state: 'PENDING', order: 6 }),
    ];

    const plan = planContractMigration(items);

    expect(plan).not.toBeNull();
    expect(plan!.goal).toMatchObject({
      key: 'get_contract_signed',
      label: 'Get the contract signed',
      completedBy: 'USER',
      requiredForStatus: 'CONFIRMED',
      autoCompleteRule: null,
      order: 4, // lowest order of the cluster
    });
    expect(stepKey(plan!.steps)).toEqual(['create_contract', 'send_contract', 'contract_signed']);
    expect([...plan!.deleteIds].sort((a, b) => a.localeCompare(b))).toEqual(['cc', 'cs', 'sc']);
  });

  it('rolls the goal up from the carried step states (mixed → PENDING)', () => {
    const items = [
      flat({ key: 'create_contract', state: 'COMPLETE', completedAt: new Date('2026-01-01') }),
      flat({ key: 'send_contract', state: 'COMPLETE', completedAt: new Date('2026-01-02') }),
      flat({ key: 'contract_signed', state: 'PENDING' }),
    ];

    const plan = planContractMigration(items)!;

    expect(plan.goal.state).toBe('PENDING');
    const signed = plan.steps.find((s) => s.key === 'contract_signed')!;
    expect(signed).toMatchObject({ state: 'PENDING', completeMode: 'AWAITED', completedBy: 'CUSTOMER', completedAt: null });
    const created = plan.steps.find((s) => s.key === 'create_contract')!;
    expect(created).toMatchObject({ state: 'COMPLETE', completeMode: 'ACTION', completedBy: 'USER' });
    expect(created.completedAt).toEqual(new Date('2026-01-01'));
  });

  it('rolls the goal up to COMPLETE with the latest step completion as its completedAt', () => {
    const items = [
      flat({ key: 'create_contract', state: 'COMPLETE', completedAt: new Date('2026-01-01') }),
      flat({ key: 'send_contract', state: 'COMPLETE', completedAt: new Date('2026-01-02') }),
      flat({ key: 'contract_signed', state: 'COMPLETE', completedAt: new Date('2026-01-05') }),
    ];
    const plan = planContractMigration(items)!;
    expect(plan.goal.state).toBe('COMPLETE');
    expect(plan.goal.completedAt).toEqual(new Date('2026-01-05'));
  });

  it('leaves completedAt null while the goal is still PENDING', () => {
    const items = [
      flat({ key: 'create_contract', state: 'COMPLETE', completedAt: new Date('2026-01-01') }),
      flat({ key: 'send_contract', state: 'PENDING' }),
      flat({ key: 'contract_signed', state: 'PENDING' }),
    ];
    expect(planContractMigration(items)!.goal.completedAt).toBeNull();
  });

  it('rolls the goal up to FAILED when a flat item is FAILED (bounced send)', () => {
    const items = [
      flat({ key: 'create_contract', state: 'COMPLETE', completedAt: new Date('2026-01-01') }),
      flat({ key: 'send_contract', state: 'FAILED' }),
      flat({ key: 'contract_signed', state: 'PENDING' }),
    ];
    expect(planContractMigration(items)!.goal.state).toBe('FAILED');
  });

  it('normalises the retired BLOCKED state (and a skipped flat item) to a PENDING step', () => {
    const items = [
      flat({ key: 'create_contract', state: 'COMPLETE', completedAt: new Date('2026-01-01') }),
      flat({ key: 'send_contract', state: 'BLOCKED' }),
      flat({ key: 'contract_signed', state: 'SKIPPED' }),
    ];
    const plan = planContractMigration(items)!;
    expect(plan.steps.find((s) => s.key === 'send_contract')!.state).toBe('PENDING');
    expect(plan.steps.find((s) => s.key === 'contract_signed')!.state).toBe('PENDING');
  });

  it('carries the send_contract due date onto the goal (the -60 surfacing anchor)', () => {
    const due = new Date('2026-08-01');
    const items = [
      flat({ key: 'create_contract', state: 'PENDING' }),
      flat({ key: 'send_contract', state: 'PENDING', dueDate: due }),
      flat({ key: 'contract_signed', state: 'PENDING' }),
    ];
    expect(planContractMigration(items)!.goal.dueDate).toEqual(due);
  });

  it('yields the full canonical spine even from a partial cluster, defaulting missing steps to PENDING', () => {
    // Only create_contract present (e.g. a manually-pruned booking) — the goal still gets all 3 steps.
    const items = [flat({ key: 'create_contract', state: 'COMPLETE', completedAt: new Date('2026-01-01') })];
    const plan = planContractMigration(items)!;
    expect(stepKey(plan.steps)).toEqual(['create_contract', 'send_contract', 'contract_signed']);
    expect(plan.steps.find((s) => s.key === 'send_contract')!.state).toBe('PENDING');
    expect(plan.deleteIds).toEqual(['id-create_contract']);
  });

  it('is idempotent — returns null when a get_contract_signed goal already exists', () => {
    const items = [
      flat({ key: 'get_contract_signed', state: 'PENDING' }),
      flat({ key: 'create_contract', state: 'COMPLETE' }), // a stray leftover must not re-trigger
    ];
    expect(planContractMigration(items)).toBeNull();
  });

  it('returns null when there is no contract cluster to collapse', () => {
    const items = [flat({ key: 'send_quote', state: 'COMPLETE' }), flat({ key: 'play_the_gig', state: 'PENDING' })];
    expect(planContractMigration(items)).toBeNull();
  });

  it('leaves non-contract items out of the plan (deleteIds names only the cluster)', () => {
    const items = [
      flat({ id: 'sq', key: 'send_quote', state: 'COMPLETE' }),
      flat({ id: 'cc', key: 'create_contract', state: 'PENDING' }),
      flat({ id: 'sc', key: 'send_contract', state: 'PENDING' }),
      flat({ id: 'cs', key: 'contract_signed', state: 'PENDING' }),
    ];
    expect([...planContractMigration(items)!.deleteIds].sort((a, b) => a.localeCompare(b))).toEqual(['cc', 'cs', 'sc']);
  });
});

describe('planTemplateMigration (saved checklist template, #607 AC1)', () => {
  const tmpl = (key: string | null, extra: Partial<ChecklistDefaultItem> = {}): ChecklistDefaultItem => ({
    key: key as string,
    label: key ?? 'Custom',
    completedBy: 'USER',
    dependsOn: [],
    autoCompleteRule: null,
    requiredForStatus: 'CONFIRMED',
    dueDateRule: null,
    ...extra,
  });

  it('collapses the three flat contract entries into the canonical get_contract_signed goal in place', () => {
    const stored = [
      tmpl('send_quote', { requiredForStatus: 'PROVISIONAL' }),
      tmpl('create_contract'),
      tmpl('send_contract'),
      tmpl('contract_signed'),
      tmpl('play_the_gig', { requiredForStatus: 'COMPLETE' }),
    ];

    const next = planTemplateMigration(stored)!;

    expect(next.map((d) => d.key)).toEqual(['send_quote', 'get_contract_signed', 'play_the_gig']);
    const goal = next.find((d) => d.key === 'get_contract_signed')!;
    expect(goal.steps?.map((s) => s.key)).toEqual(['create_contract', 'send_contract', 'contract_signed']);
    expect(goal.autoCompleteRule).toBeNull();
  });

  it('preserves the user’s other overrides and custom items', () => {
    const stored = [
      tmpl('send_quote', { enabled: false }),
      tmpl('create_contract'),
      tmpl('send_contract'),
      tmpl('contract_signed'),
      tmpl(null, { label: 'Bring spare strings', concern: null }),
    ];

    const next = planTemplateMigration(stored)!;

    expect(next.find((d) => d.key === 'send_quote')!.enabled).toBe(false);
    expect(next.some((d) => d.label === 'Bring spare strings')).toBe(true);
  });

  it('returns null when the template already has no old contract keys (current or empty)', () => {
    expect(planTemplateMigration([tmpl('send_quote'), tmpl('get_contract_signed')])).toBeNull();
    expect(planTemplateMigration([])).toBeNull();
  });
});
