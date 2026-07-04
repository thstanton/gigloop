import { ChecklistDefaultItem } from '../bookings/checklist-defaults';
import {
  BALANCE_GOAL_KEY,
  BALANCE_STEP_KEY,
  canonicalBalanceRule,
  isBalanceRuleCurrent,
  planBalanceTemplateMigration,
} from './checklist-balance-rule-migration';

// A minimal stored template goal with a balance_received step carrying the given rule.
function balanceGoal(rule: Record<string, unknown> | null): ChecklistDefaultItem {
  return {
    key: BALANCE_GOAL_KEY,
    label: 'Get the balance paid',
    completedBy: 'USER',
    dependsOn: [],
    autoCompleteRule: null,
    requiredForStatus: 'READY',
    dueDateRule: { basis: 'bookingDate', offsetDays: -14 },
    steps: [
      { key: 'send_balance_invoice', label: 'Send balance invoice', kind: 'MILESTONE', completeMode: 'ACTION', completedBy: 'USER', autoCompleteRule: { type: 'communicationSent', templateTypes: ['balance_invoice_cover'] } },
      { key: BALANCE_STEP_KEY, label: 'Balance received', kind: 'MILESTONE', completeMode: 'AWAITED', completedBy: 'USER', autoCompleteRule: rule },
    ],
  };
}

describe('canonicalBalanceRule', () => {
  it('sources the invoicePaid rule from the catalogue', () => {
    expect(canonicalBalanceRule()).toEqual({ type: 'invoicePaid', isDeposit: false });
  });
});

describe('isBalanceRuleCurrent', () => {
  it('is true only for an invoicePaid rule', () => {
    expect(isBalanceRuleCurrent({ type: 'invoicePaid', isDeposit: false })).toBe(true);
    expect(isBalanceRuleCurrent(null)).toBe(false);
    expect(isBalanceRuleCurrent(undefined)).toBe(false);
    expect(isBalanceRuleCurrent({ type: 'communicationSent' })).toBe(false);
  });
});

describe('planBalanceTemplateMigration', () => {
  it('back-fills the balance_received rule when stored as null', () => {
    const next = planBalanceTemplateMigration([balanceGoal(null)])!;
    const step = next[0].steps!.find((s) => s.key === BALANCE_STEP_KEY)!;
    expect(step.autoCompleteRule).toEqual({ type: 'invoicePaid', isDeposit: false });
  });

  it('leaves the other steps untouched', () => {
    const next = planBalanceTemplateMigration([balanceGoal(null)])!;
    const send = next[0].steps!.find((s) => s.key === 'send_balance_invoice')!;
    expect(send.autoCompleteRule).toEqual({ type: 'communicationSent', templateTypes: ['balance_invoice_cover'] });
  });

  it('is idempotent — returns null when the rule is already invoicePaid', () => {
    expect(planBalanceTemplateMigration([balanceGoal({ type: 'invoicePaid', isDeposit: false })])).toBeNull();
  });

  it('returns null when there is no balance goal in the template', () => {
    const otherGoal: ChecklistDefaultItem = {
      key: 'get_deposit_paid', label: 'Get the deposit paid', completedBy: 'USER', dependsOn: [],
      autoCompleteRule: null, requiredForStatus: 'CONFIRMED', dueDateRule: null,
    };
    expect(planBalanceTemplateMigration([otherGoal])).toBeNull();
  });

  it('returns null when the balance goal has no balance_received step', () => {
    const goal = balanceGoal(null);
    goal.steps = goal.steps!.filter((s) => s.key !== BALANCE_STEP_KEY);
    expect(planBalanceTemplateMigration([goal])).toBeNull();
  });
});
