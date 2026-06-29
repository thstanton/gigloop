import { rollUp, activeStep, StepState } from './checklist-rollup';

const step = (state: StepState, order = 0) => ({ state, order });

describe('rollUp', () => {
  it('is COMPLETE only when every step is COMPLETE', () => {
    expect(rollUp([step('COMPLETE'), step('COMPLETE')])).toBe('COMPLETE');
  });

  it('is PENDING when any step is still PENDING', () => {
    expect(rollUp([step('COMPLETE'), step('PENDING')])).toBe('PENDING');
    expect(rollUp([step('PENDING'), step('PENDING')])).toBe('PENDING');
  });

  it('is FAILED when any step is FAILED — precedence over all-other-COMPLETE', () => {
    expect(rollUp([step('COMPLETE'), step('FAILED')])).toBe('FAILED');
    expect(rollUp([step('FAILED'), step('PENDING')])).toBe('FAILED');
  });

  it('FAILED wins even if it is the only non-complete step', () => {
    expect(rollUp([step('COMPLETE'), step('COMPLETE'), step('FAILED')])).toBe('FAILED');
  });

  it('treats an empty step list as PENDING, never vacuously COMPLETE', () => {
    expect(rollUp([])).toBe('PENDING');
  });

  it('never returns SKIPPED (a goal-only opt-out, never a step state)', () => {
    const combos: StepState[][] = [
      ['PENDING'],
      ['COMPLETE'],
      ['FAILED'],
      ['COMPLETE', 'PENDING', 'FAILED'],
    ];
    for (const c of combos) expect(rollUp(c.map((s) => step(s)))).not.toBe('SKIPPED');
  });
});

describe('activeStep', () => {
  it('returns the first non-terminal step by order', () => {
    const steps = [
      { id: 'b', state: 'PENDING' as StepState, order: 2 },
      { id: 'a', state: 'COMPLETE' as StepState, order: 1 },
      { id: 'c', state: 'PENDING' as StepState, order: 3 },
    ];
    expect(activeStep(steps)?.id).toBe('b');
  });

  it('skips FAILED as well as COMPLETE when finding the active step', () => {
    const steps = [
      { id: 'a', state: 'FAILED' as StepState, order: 1 },
      { id: 'b', state: 'PENDING' as StepState, order: 2 },
    ];
    expect(activeStep(steps)?.id).toBe('b');
  });

  it('returns null when every step is terminal', () => {
    const steps = [
      { id: 'a', state: 'COMPLETE' as StepState, order: 1 },
      { id: 'b', state: 'COMPLETE' as StepState, order: 2 },
    ];
    expect(activeStep(steps)).toBeNull();
  });
});
