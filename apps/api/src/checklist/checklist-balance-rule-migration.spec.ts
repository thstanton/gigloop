import {
  canonicalBalanceRule,
  isBalanceRuleCurrent,
} from './checklist-balance-rule-migration';

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
