/**
 * The materialised state of a Goal (ADR-0057). A Goal is PENDING | COMPLETE |
 * FAILED | SKIPPED. SKIPPED is the musician's opt-out — set directly on the goal,
 * never derived — so it never appears as a Step state and `rollUp` never returns
 * it. A Step is only PENDING | COMPLETE | FAILED.
 */
export type ChecklistState = 'PENDING' | 'COMPLETE' | 'FAILED' | 'SKIPPED';
export type StepState = 'PENDING' | 'COMPLETE' | 'FAILED';

/**
 * Roll a multi-step Goal's state up from its Steps — the pure function that makes
 * goal state a materialised view of its steps, never able to drift from them.
 *
 * - any Step FAILED            → FAILED   (a bounced send fails the goal)
 * - every Step COMPLETE        → COMPLETE
 * - otherwise                  → PENDING
 *
 * FAILED takes precedence over COMPLETE. Only ever called for multi-step goals;
 * an empty list (which would vacuously satisfy "every COMPLETE") is defended as
 * PENDING rather than COMPLETE — atomic goals never reach this path.
 *
 * v1 is MILESTONE-only, so kind-aware roll-up (follow-up steps that never block)
 * is deliberately not built here; it arrives with the FOLLOWUP increment.
 */
export function rollUp(steps: ReadonlyArray<{ state: StepState }>): ChecklistState {
  if (steps.length === 0) return 'PENDING';
  if (steps.some((s) => s.state === 'FAILED')) return 'FAILED';
  if (steps.every((s) => s.state === 'COMPLETE')) return 'COMPLETE';
  return 'PENDING';
}

/**
 * The active Step of a multi-step goal — the first non-terminal step by `order`.
 * The active step is *derived*, never stored (ADR-0057 retires BLOCKED). Returns
 * null when every step is terminal (the goal has rolled up to COMPLETE/FAILED).
 */
export function activeStep<T extends { state: StepState; order: number }>(
  steps: ReadonlyArray<T>,
): T | null {
  return (
    [...steps]
      .sort((a, b) => a.order - b.order)
      .find((s) => s.state !== 'COMPLETE' && s.state !== 'FAILED') ?? null
  );
}
