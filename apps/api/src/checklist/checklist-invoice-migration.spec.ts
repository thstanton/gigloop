import {
  ExistingStep,
  planInvoiceGoalMigration,
} from './checklist-invoice-migration';

function st(overrides: Partial<ExistingStep> & { key: string }): ExistingStep {
  return { key: overrides.key, state: overrides.state ?? 'PENDING', completedAt: overrides.completedAt ?? null };
}

const stepKeys = (steps: { key: string }[]) => steps.map((s) => s.key);

describe('planInvoiceGoalMigration — deposit (get_deposit_paid, ADR-0057 / #617)', () => {
  it('inserts the issue step → 4-step create→issue→send→received spine', () => {
    const existing = [
      st({ key: 'create_deposit_invoice', state: 'PENDING' }),
      st({ key: 'send_deposit_invoice', state: 'PENDING' }),
      st({ key: 'deposit_received', state: 'PENDING' }),
    ];
    const plan = planInvoiceGoalMigration('get_deposit_paid', 'PENDING', existing)!;
    expect(stepKeys(plan.steps)).toEqual([
      'set_fee_deposit',
      'add_email_deposit',
      'create_deposit_invoice',
      'issue_deposit_invoice',
      'send_deposit_invoice',
      'deposit_received',
    ]);
    expect(plan.newGoalKey).toBe('get_deposit_paid');
    // The create step now carries the includeDraft rule; issue keeps the non-draft rule.
    const create = plan.steps.find((s) => s.key === 'create_deposit_invoice')!;
    expect(create.autoCompleteRule).toMatchObject({ type: 'invoiceExists', isDeposit: true, includeDraft: true });
    const issue = plan.steps.find((s) => s.key === 'issue_deposit_invoice')!;
    expect(issue.autoCompleteRule).toMatchObject({ type: 'invoiceExists', isDeposit: true });
    expect(issue.autoCompleteRule).not.toHaveProperty('includeDraft');
  });

  it('leaves the new issue step PENDING while nothing later is complete (evaluate() settles it)', () => {
    const existing = [
      st({ key: 'create_deposit_invoice', state: 'COMPLETE', completedAt: new Date('2026-01-01') }),
      st({ key: 'send_deposit_invoice', state: 'PENDING' }),
      st({ key: 'deposit_received', state: 'PENDING' }),
    ];
    const plan = planInvoiceGoalMigration('get_deposit_paid', 'PENDING', existing)!;
    expect(plan.steps.find((s) => s.key === 'issue_deposit_invoice')!.state).toBe('PENDING');
    expect(plan.goalState).toBe('PENDING');
  });

  it('back-fills the new issue step COMPLETE when a later step is already complete (no nag)', () => {
    const existing = [
      st({ key: 'create_deposit_invoice', state: 'COMPLETE', completedAt: new Date('2026-01-01') }),
      st({ key: 'send_deposit_invoice', state: 'COMPLETE', completedAt: new Date('2026-01-02') }),
      st({ key: 'deposit_received', state: 'COMPLETE', completedAt: new Date('2026-02-01') }),
    ];
    const plan = planInvoiceGoalMigration('get_deposit_paid', 'COMPLETE', existing)!;
    expect(plan.steps.find((s) => s.key === 'issue_deposit_invoice')!.state).toBe('COMPLETE');
    expect(plan.goalState).toBe('COMPLETE');
    expect(plan.goalCompletedAt).toEqual(new Date('2026-02-01'));
  });

  it('is idempotent — a goal already in the canonical shape is a no-op', () => {
    const existing = [
      st({ key: 'set_fee_deposit' }),
      st({ key: 'add_email_deposit' }),
      st({ key: 'create_deposit_invoice' }),
      st({ key: 'issue_deposit_invoice' }),
      st({ key: 'send_deposit_invoice' }),
      st({ key: 'deposit_received' }),
    ];
    expect(planInvoiceGoalMigration('get_deposit_paid', 'PENDING', existing)).toBeNull();
  });
});

describe('planInvoiceGoalMigration — balance (invoice_the_balance → get_the_balance_paid)', () => {
  it('renames the goal and reshapes to create→issue→send→received', () => {
    const existing = [
      st({ key: 'create_balance_invoice', state: 'PENDING' }),
      st({ key: 'send_balance_invoice', state: 'PENDING' }),
    ];
    const plan = planInvoiceGoalMigration('get_the_balance_paid', 'PENDING', existing)!;
    expect(plan.newGoalKey).toBe('get_the_balance_paid');
    expect(plan.newGoalLabel).toBe('Get the balance paid');
    expect(stepKeys(plan.steps)).toEqual([
      'set_fee_balance',
      'add_email_balance',
      'create_balance_invoice',
      'issue_balance_invoice',
      'send_balance_invoice',
      'balance_received',
    ]);
  });

  it('carries an already-COMPLETE balance goal onto balance_received — no re-nag (Story 21)', () => {
    // Old balance goal ended at "send" and was COMPLETE. The new balance_received step must inherit
    // that completion: its #653 invoicePaid rule needs a PAID invoice a cash-settled balance never
    // had, so the evaluate() sweep cannot reconstruct it (Story 21 — no re-nag).
    const existing = [
      st({ key: 'create_balance_invoice', state: 'COMPLETE', completedAt: new Date('2026-03-01') }),
      st({ key: 'send_balance_invoice', state: 'COMPLETE', completedAt: new Date('2026-03-02') }),
    ];
    const plan = planInvoiceGoalMigration('get_the_balance_paid', 'COMPLETE', existing)!;
    expect(plan.steps.find((s) => s.key === 'balance_received')!.state).toBe('COMPLETE');
    expect(plan.goalState).toBe('COMPLETE');
  });

  it('leaves balance_received PENDING when the old balance goal was not complete (keeps chasing)', () => {
    const existing = [
      st({ key: 'create_balance_invoice', state: 'COMPLETE', completedAt: new Date('2026-03-01') }),
      st({ key: 'send_balance_invoice', state: 'PENDING' }),
    ];
    const plan = planInvoiceGoalMigration('get_the_balance_paid', 'PENDING', existing)!;
    expect(plan.steps.find((s) => s.key === 'balance_received')!.state).toBe('PENDING');
    expect(plan.goalState).toBe('PENDING');
  });
});
