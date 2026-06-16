// Terminal-signal module (ADR-0045 §5): the two-signal terminal that fixes the
// false-PRD-completion bug. A pure function over the agent's FULL final message,
// returning the loop's terminal routing decision. Replaces loop-decision.mjs's
// remaining-count adjudication — bash no longer recounts work; the AGENT judges
// doneness and emits a token, and bash routes on it.
//
// Returns: 'COMPLETE' | 'HANDOFF' | 'CONTINUE'
//   COMPLETE → every slice delivered → finish_run opens the PR
//   HANDOFF  → open HITL/blocked slices remain → stop + notify, NO PR
//   CONTINUE → neither signal (more ready-for-agent work, or a truncated/garbled
//              iteration) → the afk loop runs another cold pass
//
// Matching is ONLY against the <promise>…</promise> wrapper PROMPT.md emits (decided
// 2026-06-16): a bare phrase in prose — or quoted issue text, which Ralph routinely
// echoes — must NOT route. The asymmetry is the whole point: a false HANDOFF or
// false CONTINUE is safe (a human is pinged / the iteration resumes), but a false
// COMPLETE opens a premature PR — the exact bug class that regressed twice. Dropping
// the tags therefore degrades to CONTINUE, the safe direction.

export const COMPLETE = 'COMPLETE';
export const HANDOFF = 'HANDOFF';
export const CONTINUE = 'CONTINUE';

const PROMISE = /<promise>([\s\S]*?)<\/promise>/g;

/**
 * @param {string|null|undefined} output  the agent's final message for the iteration
 * @returns {'COMPLETE' | 'HANDOFF' | 'CONTINUE'}
 */
export function classify(output) {
  const text = String(output ?? '');
  const blocks = [];
  for (const m of text.matchAll(PROMISE)) blocks.push(m[1]);
  const inAnyPromise = (token) => blocks.some((b) => b.includes(token));

  // HANDOFF is checked first so a "human needed" signal is never masked by a
  // co-occurring completion claim (ADR-0045 §5: both present → HANDOFF wins).
  if (inAnyPromise('HANDOFF')) return HANDOFF;
  if (inAnyPromise('NO MORE TASKS')) return COMPLETE;
  return CONTINUE;
}

// CLI: read the agent's final message on stdin, print the signal on stdout.
//   printf '%s' "$agent_out" | node terminal-signal.mjs  ->  COMPLETE|HANDOFF|CONTINUE
if (import.meta.url === `file://${process.argv[1]}`) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => (input += chunk));
  process.stdin.on('end', () => console.log(classify(input)));
}
