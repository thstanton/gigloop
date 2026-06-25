import { describe, it, expect } from 'vitest';
import { propagateBlocking } from './useBookingChecklist';
import type { ChecklistItem } from '@/types/api';

function item(overrides: Partial<ChecklistItem> & Pick<ChecklistItem, 'id' | 'state'>): ChecklistItem {
  return {
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    bookingId: 'b1',
    key: null,
    label: 'Item',
    completedBy: 'USER',
    order: 0,
    dependsOn: [],
    autoCompleteRule: null,
    requiredForStatus: null,
    completedAt: null,
    dueDate: null,
    dueDateRule: null,
    concern: null,
    ...overrides,
  };
}

describe('propagateBlocking', () => {
  it('unblocks a dependent (BLOCKED→PENDING) when its dependency is now COMPLETE', () => {
    const items = [
      item({ id: 'dep', key: 'send_contract', state: 'COMPLETE' }),
      item({ id: 'child', state: 'BLOCKED', dependsOn: ['send_contract'] }),
    ];

    const result = propagateBlocking(items);

    expect(result.find((i) => i.id === 'child')?.state).toBe('PENDING');
  });

  it('treats a SKIPPED dependency as satisfied (unblocks the dependent)', () => {
    const items = [
      item({ id: 'dep', key: 'send_contract', state: 'SKIPPED' }),
      item({ id: 'child', state: 'BLOCKED', dependsOn: ['send_contract'] }),
    ];

    expect(propagateBlocking(items).find((i) => i.id === 'child')?.state).toBe('PENDING');
  });

  it('re-blocks a dependent (PENDING→BLOCKED) when its dependency is un-completed', () => {
    const items = [
      item({ id: 'dep', key: 'send_contract', state: 'PENDING' }),
      item({ id: 'child', state: 'PENDING', dependsOn: ['send_contract'] }),
    ];

    expect(propagateBlocking(items).find((i) => i.id === 'child')?.state).toBe('BLOCKED');
  });

  it('treats a dependency key not present in the list as satisfied', () => {
    const items = [item({ id: 'child', state: 'BLOCKED', dependsOn: ['missing_key'] })];

    expect(propagateBlocking(items)[0].state).toBe('PENDING');
  });

  it('never touches terminal states (COMPLETE/SKIPPED/FAILED) even when a dependency regresses', () => {
    const items = [
      item({ id: 'dep', key: 'send_contract', state: 'PENDING' }),
      item({ id: 'done', state: 'COMPLETE', dependsOn: ['send_contract'] }),
      item({ id: 'skipped', state: 'SKIPPED', dependsOn: ['send_contract'] }),
      item({ id: 'failed', state: 'FAILED', dependsOn: ['send_contract'] }),
    ];

    const result = propagateBlocking(items);

    expect(result.find((i) => i.id === 'done')?.state).toBe('COMPLETE');
    expect(result.find((i) => i.id === 'skipped')?.state).toBe('SKIPPED');
    expect(result.find((i) => i.id === 'failed')?.state).toBe('FAILED');
  });

  it('leaves items with no dependencies untouched', () => {
    const items = [item({ id: 'solo', state: 'PENDING' })];
    const result = propagateBlocking(items);
    expect(result[0]).toBe(items[0]);
  });

  it('blocks while any one of several dependencies is unsatisfied', () => {
    const items = [
      item({ id: 'a', key: 'a', state: 'COMPLETE' }),
      item({ id: 'b', key: 'b', state: 'PENDING' }),
      item({ id: 'child', state: 'PENDING', dependsOn: ['a', 'b'] }),
    ];

    expect(propagateBlocking(items).find((i) => i.id === 'child')?.state).toBe('BLOCKED');
  });
});
