import { ChecklistDefaultItem } from '../bookings/checklist-defaults';
import {
  FlatChecklistItem,
  planQuoteMigration,
  planQuoteTemplateMigration,
} from './checklist-quote-migration';

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

describe('planQuoteMigration — quote cluster (get_the_quote_accepted, ADR-0057 / #616)', () => {
  it('collapses the flat send_quote + confirm_quote cluster into the goal + send→accepted spine', () => {
    const items = [
      flat({ id: 'sq', key: 'send_quote', state: 'COMPLETE', completedAt: new Date('2026-01-01'), order: 1, dueDate: new Date('2026-01-03') }),
      flat({ id: 'cq', key: 'confirm_quote', state: 'PENDING', order: 2 }),
    ];

    const plan = planQuoteMigration(items)!;

    expect(plan.goal).toMatchObject({
      key: 'get_the_quote_accepted',
      completedBy: 'USER',
      requiredForStatus: 'PROVISIONAL',
      autoCompleteRule: null,
      order: 1, // lowest order of the cluster
    });
    expect(stepKeys(plan.steps)).toEqual(['send_quote', 'quote_accepted']);
    // Both old flat rows are deleted — confirm_quote is not orphaned by the rename.
    expect([...plan.deleteIds].sort((a, b) => a.localeCompare(b))).toEqual(['cq', 'sq']);
  });

  it('keeps a sent-but-unaccepted quote surfacing: send_quote COMPLETE, quote_accepted PENDING', () => {
    const items = [
      flat({ key: 'send_quote', state: 'COMPLETE', completedAt: new Date('2026-01-01') }),
      flat({ key: 'confirm_quote', state: 'PENDING' }),
    ];
    const plan = planQuoteMigration(items)!;
    expect(plan.steps.find((s) => s.key === 'send_quote')!).toMatchObject({ state: 'COMPLETE', completeMode: 'ACTION' });
    const accepted = plan.steps.find((s) => s.key === 'quote_accepted')!;
    expect(accepted).toMatchObject({ state: 'PENDING', completeMode: 'AWAITED', completedBy: 'USER', autoCompleteRule: null });
    expect(plan.goal.state).toBe('PENDING');
  });

  it('migrates an ACCEPTED quote (old confirm_quote COMPLETE) onto quote_accepted — state not orphaned', () => {
    // The rename wrinkle: the old `confirm_quote` item's COMPLETE state must land on the renamed
    // `quote_accepted` step, not be lost; the monotonic spine then back-fills send_quote so an
    // accepted-but-no-recorded-send booking reads COMPLETE, never re-nagging "Send the quote".
    const items = [
      flat({ key: 'send_quote', state: 'PENDING' }),
      flat({ key: 'confirm_quote', state: 'COMPLETE', completedAt: new Date('2026-02-01') }),
    ];
    const plan = planQuoteMigration(items)!;
    expect(plan.steps.find((s) => s.key === 'quote_accepted')!).toMatchObject({ state: 'COMPLETE', completedAt: new Date('2026-02-01') });
    expect(plan.steps.find((s) => s.key === 'send_quote')!.state).toBe('COMPLETE'); // back-filled
    expect(plan.goal.state).toBe('COMPLETE');
    // Goal completedAt is the latest real step completion (the accepted date), not the back-fill.
    expect(plan.goal.completedAt).toEqual(new Date('2026-02-01'));
  });

  it('handles a partial cluster (only send_quote present) — quote_accepted seeds PENDING', () => {
    const items = [flat({ key: 'send_quote', state: 'COMPLETE', completedAt: new Date('2026-01-01') })];
    const plan = planQuoteMigration(items)!;
    expect(stepKeys(plan.steps)).toEqual(['send_quote', 'quote_accepted']);
    expect(plan.steps.find((s) => s.key === 'quote_accepted')!.state).toBe('PENDING');
    expect(plan.goal.state).toBe('PENDING');
    expect(plan.deleteIds).toEqual(['id-send_quote']);
  });

  it('carries the earliest cluster due date onto the goal (the surfacing anchor)', () => {
    const items = [
      flat({ key: 'send_quote', state: 'PENDING', dueDate: new Date('2026-01-05') }),
      flat({ key: 'confirm_quote', state: 'PENDING' }), // no due date
    ];
    const plan = planQuoteMigration(items)!;
    expect(plan.goal.dueDate).toEqual(new Date('2026-01-05'));
    // The goal also carries the canonical recompute rule (bookingCreation + 2).
    expect(plan.goal.dueDateRule).toEqual({ basis: 'bookingCreation', offsetDays: 2 });
  });

  it('is idempotent — a booking that already has the goal is a no-op', () => {
    const items = [
      flat({ key: 'get_the_quote_accepted', state: 'PENDING' }),
      flat({ key: 'send_quote', state: 'COMPLETE' }), // stray, but the goal exists → skip
    ];
    expect(planQuoteMigration(items)).toBeNull();
  });

  it('returns null when there is no quote cluster to collapse', () => {
    const items = [flat({ key: 'get_deposit_paid', state: 'PENDING' })];
    expect(planQuoteMigration(items)).toBeNull();
  });
});

describe('planQuoteTemplateMigration — saved checklist defaults', () => {
  function tpl(overrides: Omit<Partial<ChecklistDefaultItem>, 'key'> & { key: string | null }): ChecklistDefaultItem {
    return {
      // Custom items carry a null key at runtime (the type declares `string`); mirror that.
      key: overrides.key as unknown as string,
      label: overrides.label ?? 'X',
      completedBy: overrides.completedBy ?? 'USER',
      dependsOn: overrides.dependsOn ?? [],
      autoCompleteRule: overrides.autoCompleteRule ?? null,
      requiredForStatus: overrides.requiredForStatus ?? 'PROVISIONAL',
      dueDateRule: overrides.dueDateRule ?? null,
      ...(overrides.concern !== undefined ? { concern: overrides.concern } : {}),
      ...(overrides.enabled !== undefined ? { enabled: overrides.enabled } : {}),
    };
  }

  it('collapses the flat send_quote + confirm_quote template entries into one goal entry', () => {
    const stored = [
      tpl({ key: 'send_quote', label: 'Send quote' }),
      tpl({ key: 'confirm_quote', label: 'Quote confirmed' }),
      tpl({ key: 'get_deposit_paid', label: 'Get the deposit paid', requiredForStatus: 'CONFIRMED' }),
    ];
    const next = planQuoteTemplateMigration(stored)!;
    expect(next.map((d) => d.key)).toEqual(['get_the_quote_accepted', 'get_deposit_paid']);
    // The inserted entry is the canonical goal (no rule, multi-step).
    expect(next[0]).toMatchObject({ key: 'get_the_quote_accepted', autoCompleteRule: null });
  });

  it('preserves other system items and custom items, and their order', () => {
    const stored = [
      tpl({ key: 'send_quote' }),
      tpl({ key: null, label: 'Book parking', concern: 'venue', requiredForStatus: null }),
      tpl({ key: 'confirm_quote' }),
      tpl({ key: 'play_the_gig', requiredForStatus: 'COMPLETE' }),
    ];
    const next = planQuoteTemplateMigration(stored)!;
    expect(next.map((d) => d.key)).toEqual(['get_the_quote_accepted', null, 'play_the_gig']);
    expect(next.find((d) => d.label === 'Book parking')).toMatchObject({ concern: 'venue' });
  });

  it('returns null when the template has no flat quote keys', () => {
    const stored = [tpl({ key: 'get_the_quote_accepted' }), tpl({ key: 'get_deposit_paid' })];
    expect(planQuoteTemplateMigration(stored)).toBeNull();
  });
});
