// Loop-decision module (ADR-0040): pure function encoding verify-before-honour-promise.
// gateExitCode: exit code of the commit/push gate (0 = green, non-zero = red)
// promisePresent: whether the agent issued a completion promise this iteration
// remainingWorkCount: open issues/items still to do (mode-agnostic)
// Returns: 'CONTINUE' | 'COMPLETE'
// ESCALATE is raised by the caller's per-issue K-attempts guard, not here.

export const CONTINUE = 'CONTINUE';
export const COMPLETE = 'COMPLETE';

// CLI: node loop-decision.mjs <gateExitCode> <promisePresent> <remainingWorkCount>
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , gate, promise, remaining] = process.argv;
  console.log(decide(parseInt(gate, 10), promise === 'true', parseInt(remaining, 10)));
}

/**
 * @param {number} gateExitCode
 * @param {boolean} promisePresent
 * @param {number} remainingWorkCount
 * @returns {'CONTINUE' | 'COMPLETE'}
 */
export function decide(gateExitCode, promisePresent, remainingWorkCount) {
  if (gateExitCode !== 0) return CONTINUE;
  if (remainingWorkCount === 0) return COMPLETE;
  return CONTINUE;
}
