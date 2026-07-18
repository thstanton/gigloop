import { describe, it, expect } from 'vitest';
import { buildConfiguratorSections, ANYTIME_STAGE } from './configuratorSections';
import type { ChecklistDefaultItem, ChecklistDefaultStep } from '@/types/api';

function step(overrides: Partial<ChecklistDefaultStep> & { key: string; label: string }): ChecklistDefaultStep {
  return {
    kind: 'MILESTONE',
    completeMode: 'ACTION',
    completedBy: 'USER',
    autoCompleteRule: null,
    ...overrides,
  };
}

// One factory for both a system goal (pass a `key`) and a custom item (omit `key` → null).
function item(overrides: Partial<ChecklistDefaultItem> & { label: string }): ChecklistDefaultItem {
  return {
    key: null,
    completedBy: 'USER',
    autoCompleteRule: null,
    requiredForStatus: null,
    dueDateRule: null,
    ...overrides,
  };
}

const MULTI_STEP = item({
  key: 'get_deposit_paid',
  label: 'Get the deposit paid',
  requiredForStatus: 'CONFIRMED',
  dueDateRule: { basis: 'bookingDate', offsetDays: -30 },
  steps: [
    step({ key: 'set_fee_deposit', label: 'Set the booking fee', kind: 'PRECONDITION' }),
    step({ key: 'add_email_deposit', label: "Add the client's email", kind: 'PRECONDITION' }),
    step({ key: 'create_deposit_invoice', label: 'Create deposit invoice' }),
    step({ key: 'deposit_received', label: 'Deposit received', completeMode: 'AWAITED' }),
  ],
});

const ATOMIC = item({ key: 'add_venue', label: 'Add venue', requiredForStatus: 'READY' });

describe('buildConfiguratorSections', () => {
  it('always returns the four brackets plus Anytime, in lifecycle order', () => {
    const sections = buildConfiguratorSections([]);
    expect(sections.map((s) => s.stage)).toEqual([
      'ENQUIRY',
      'PROVISIONAL',
      'CONFIRMED',
      'READY',
      ANYTIME_STAGE,
    ]);
    // Empty input → every section present but empty (each renders its own empty state / add affordance).
    expect(sections.every((s) => s.goals.length === 0 && s.customs.length === 0)).toBe(true);
  });

  it('groups a goal into the stage BEFORE its requiredForStatus (its bracket)', () => {
    const sections = buildConfiguratorSections([MULTI_STEP]);
    // Gates CONFIRMED → worked while PROVISIONAL.
    const provisional = sections.find((s) => s.stage === 'PROVISIONAL')!;
    expect(provisional.goals.map((g) => g.key)).toEqual(['get_deposit_paid']);
    const confirmed = sections.find((s) => s.stage === 'CONFIRMED')!;
    expect(confirmed.goals).toHaveLength(0);
  });

  it('splits system goals from custom items within a section', () => {
    const enquiryCustom = item({ label: 'Book the babysitter', requiredForStatus: 'PROVISIONAL' });
    const sections = buildConfiguratorSections([MULTI_STEP, enquiryCustom]);
    const enquiry = sections.find((s) => s.stage === 'ENQUIRY')!;
    // Custom gating PROVISIONAL → Enquiry bracket, kept off the goal list.
    expect(enquiry.goals).toHaveLength(0);
    expect(enquiry.customs.map((c) => c.label)).toEqual(['Book the babysitter']);
    const provisional = sections.find((s) => s.stage === 'PROVISIONAL')!;
    expect(provisional.goals.map((g) => g.key)).toEqual(['get_deposit_paid']);
    expect(provisional.customs).toHaveLength(0);
  });

  it('exposes the ordered read-only step list and flags multi-step vs atomic goals', () => {
    const sections = buildConfiguratorSections([MULTI_STEP, ATOMIC]);
    const provisional = sections.find((s) => s.stage === 'PROVISIONAL')!;
    const deposit = provisional.goals.find((g) => g.key === 'get_deposit_paid')!;
    expect(deposit.isMultiStep).toBe(true);
    expect(deposit.steps.map((s) => s.label)).toEqual([
      'Set the booking fee',
      "Add the client's email",
      'Create deposit invoice',
      'Deposit received',
    ]);

    // Atomic goal (READY gate → CONFIRMED bracket) has no steps and no disclosure.
    const confirmed = sections.find((s) => s.stage === 'CONFIRMED')!;
    const venue = confirmed.goals.find((g) => g.key === 'add_venue')!;
    expect(venue.isMultiStep).toBe(false);
    expect(venue.steps).toEqual([]);
  });

  it('reads enabled state from the item (backend has folded overrides in)', () => {
    const disabled = item({
      key: 'gather_song_requests',
      label: 'Gather song requests',
      requiredForStatus: 'READY',
      enabled: false,
    });
    const sections = buildConfiguratorSections([MULTI_STEP, disabled]);
    const provisional = sections.find((s) => s.stage === 'PROVISIONAL')!;
    expect(provisional.goals.find((g) => g.key === 'get_deposit_paid')!.enabled).toBe(true);
    const confirmed = sections.find((s) => s.stage === 'CONFIRMED')!;
    expect(confirmed.goals.find((g) => g.key === 'gather_song_requests')!.enabled).toBe(false);
  });

  it('puts stage-less items in Anytime and carries the source index for custom identity', () => {
    const items: ChecklistDefaultItem[] = [
      MULTI_STEP,
      item({ label: 'Chase the setlist', requiredForStatus: null, concern: 'music' }),
      item({ label: 'Charge the batteries', requiredForStatus: null }),
    ];
    const anytime = buildConfiguratorSections(items).find((s) => s.stage === ANYTIME_STAGE)!;
    expect(anytime.customs.map((c) => c.label)).toEqual(['Chase the setlist', 'Charge the batteries']);
    // Index is the position in the source array — the identity the editor mutates.
    expect(anytime.customs.map((c) => c.index)).toEqual([1, 2]);
    expect(anytime.customs[0].concern).toBe('music');
  });
});
