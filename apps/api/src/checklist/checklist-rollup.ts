/**
 * The materialised state of a Goal (ADR-0057). A Goal is PENDING | COMPLETE |
 * FAILED | SKIPPED. SKIPPED is the musician's opt-out — set directly on the goal,
 * never derived — so it never appears as a Step state and `rollUp` never returns
 * it. A Step is PENDING | COMPLETE | FAILED | DECLINED.
 */
export type ChecklistState = 'PENDING' | 'COMPLETE' | 'FAILED' | 'SKIPPED';
// DECLINED (ADR-0057 amended by ADR-0074 §5): the answer arrived, expectedly, and it was no.
// Terminal and non-contributing — never FAILED (that stays "unexpected"), never counted toward
// completion. Declared generally: any step can reach it, not only a band one.
export type StepState = 'PENDING' | 'COMPLETE' | 'FAILED' | 'DECLINED';

/**
 * Roll a multi-step Goal's state up from its Steps — the pure function that makes
 * goal state a materialised view of its steps, never able to drift from them.
 *
 * - any Step FAILED                        → FAILED   (a bounced send fails the goal)
 * - every non-DECLINED Step COMPLETE       → COMPLETE
 * - otherwise                              → PENDING
 *
 * FAILED takes precedence over COMPLETE. DECLINED steps are excluded from the completion
 * check entirely (non-contributing) so a decline can never leave the goal silently stuck
 * PENDING forever; a goal made up only of DECLINED steps is defended as PENDING, the same
 * guard as an empty list, rather than vacuously COMPLETE. Only ever called for multi-step
 * goals; atomic goals never reach this path.
 *
 * v1 is MILESTONE-only, so kind-aware roll-up (follow-up steps that never block)
 * is deliberately not built here; it arrives with the FOLLOWUP increment.
 */
export function rollUp(steps: ReadonlyArray<{ state: StepState }>): ChecklistState {
  if (steps.length === 0) return 'PENDING';
  if (steps.some((s) => s.state === 'FAILED')) return 'FAILED';
  const contributing = steps.filter((s) => s.state !== 'DECLINED');
  if (contributing.length > 0 && contributing.every((s) => s.state === 'COMPLETE')) return 'COMPLETE';
  return 'PENDING';
}

/**
 * The active Step of a multi-step goal — the first non-terminal step by `order`.
 * The active step is *derived*, never stored (ADR-0057 retires BLOCKED). Returns
 * null when every step is terminal (the goal has rolled up to COMPLETE/FAILED, or
 * every remaining step is DECLINED).
 */
export function activeStep<T extends { state: StepState; order: number }>(
  steps: ReadonlyArray<T>,
): T | null {
  return (
    [...steps]
      .sort((a, b) => a.order - b.order)
      .find((s) => s.state !== 'COMPLETE' && s.state !== 'FAILED' && s.state !== 'DECLINED') ?? null
  );
}
