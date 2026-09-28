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

  // #899 / ADR-0074 §5: DECLINED is terminal and non-contributing — excluded from the
  // completion check entirely, not merely "not complete", so a decline can never leave the
  // goal stuck PENDING forever.
  describe('DECLINED (#899)', () => {
    it('is excluded from the completion check — the goal still completes around it', () => {
      expect(rollUp([step('COMPLETE'), step('DECLINED')])).toBe('COMPLETE');
    });

    it('treats an all-DECLINED step list as PENDING, never vacuously COMPLETE (same guard as empty)', () => {
      expect(rollUp([step('DECLINED'), step('DECLINED')])).toBe('PENDING');
    });

    it('still lets FAILED win over a DECLINED sibling — a decline never masks a bounced send', () => {
      expect(rollUp([step('DECLINED'), step('FAILED')])).toBe('FAILED');
    });

    it('is PENDING when a non-declined step is still outstanding alongside a decline', () => {
      expect(rollUp([step('DECLINED'), step('PENDING')])).toBe('PENDING');
    });
  });

  it('never returns SKIPPED (a goal-only opt-out, never a step state)', () => {
    const combos: StepState[][] = [
      ['PENDING'],
      ['COMPLETE'],
      ['FAILED'],
      ['DECLINED'],
      ['COMPLETE', 'PENDING', 'FAILED'],
      ['COMPLETE', 'DECLINED'],
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

  // #899: DECLINED is terminal too — never surfaced as the goal's active step.
  it('skips DECLINED as well as COMPLETE/FAILED when finding the active step', () => {
    const steps = [
      { id: 'a', state: 'DECLINED' as StepState, order: 1 },
      { id: 'b', state: 'PENDING' as StepState, order: 2 },
    ];
    expect(activeStep(steps)?.id).toBe('b');
  });

  it('returns null when every step is COMPLETE or DECLINED', () => {
    const steps = [
      { id: 'a', state: 'COMPLETE' as StepState, order: 1 },
      { id: 'b', state: 'DECLINED' as StepState, order: 2 },
    ];
    expect(activeStep(steps)).toBeNull();
  });
});
