import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, COMPLETE, HANDOFF, CONTINUE } from './terminal-signal.mjs';

// ADR-0045 §5 — the two-signal terminal that fixes the false-PRD-completion bug.
// classify() reads the agent's FULL final message and returns one of three signals.
// The tokens are matched ONLY inside the <promise>…</promise> wrapper PROMPT.md emits
// (Tim's call, 2026-06-16): bare prose / quoted issue text containing the phrase must
// NOT route — false-COMPLETE opens a premature PR, the exact bug that regressed twice.
//
// Routing rules:
//   wrapped NO MORE TASKS → COMPLETE
//   wrapped HANDOFF       → HANDOFF
//   both wrapped          → HANDOFF wins (a "human needed" signal is never masked)
//   neither / empty / garbled → CONTINUE (a truncated iteration resumes, never "done")

const SIGNOFF = 'All set for this iteration — committed the slice and relabelled it.\n';

test('wrapped NO MORE TASKS → COMPLETE', () => {
  assert.equal(classify('<promise>NO MORE TASKS</promise>'), COMPLETE);
});

test('wrapped HANDOFF → HANDOFF', () => {
  assert.equal(classify('<promise>HANDOFF — 3 need a human</promise>'), HANDOFF);
});

test('both wrapped (separate blocks) → HANDOFF wins', () => {
  const out = '<promise>NO MORE TASKS</promise>\n<promise>HANDOFF — 2 need a human</promise>';
  assert.equal(classify(out), HANDOFF);
});

test('both tokens in one wrapped block → HANDOFF wins', () => {
  assert.equal(classify('<promise>NO MORE TASKS HANDOFF</promise>'), HANDOFF);
});

test('neither token → CONTINUE', () => {
  assert.equal(classify('<promise>worked #460, committed, relabelled</promise>'), CONTINUE);
});

test('empty output → CONTINUE', () => {
  assert.equal(classify(''), CONTINUE);
});

test('null / undefined output → CONTINUE (never throws)', () => {
  assert.equal(classify(null), CONTINUE);
  assert.equal(classify(undefined), CONTINUE);
});

// --- The cases the AC's toy phrases miss: realistic full-message inputs ---

test('wrapped token buried in a paragraph of sign-off prose → COMPLETE', () => {
  const out = `${SIGNOFF}Every child of PRD #449 is either closed or ready-for-review, so there is\nnothing left for me to pick up this run.\n\n<promise>NO MORE TASKS</promise>\n\nHanding the branch back to you.`;
  assert.equal(classify(out), COMPLETE);
});

test('wrapped HANDOFF buried in prose, with leading/trailing text → HANDOFF', () => {
  const out = `${SIGNOFF}Two slices are still labelled ready-for-human and I must not touch them.\n\n<promise>HANDOFF — 2 need a human</promise>\n`;
  assert.equal(classify(out), HANDOFF);
});

test('BARE phrase quoted from issue text (no wrapper) → CONTINUE, not a false COMPLETE', () => {
  // Ralph routinely echoes issue bodies; issue #453's own body is full of the bare
  // phrase "NO MORE TASKS". Bare, unwrapped occurrences must never complete the PRD.
  const out =
    'I worked the terminal-signal slice. The AC says: output containing NO MORE TASKS\n' +
    'maps to COMPLETE, and HANDOFF maps to HANDOFF. I committed and relabelled it.';
  assert.equal(classify(out), CONTINUE);
});

test('bare HANDOFF in prose + WRAPPED NO MORE TASKS → COMPLETE (only wrapped tokens route)', () => {
  // The symmetric guard: an unwrapped "HANDOFF" mention must not mask a real wrapped
  // completion. Only tokens inside <promise> count, so HANDOFF-wins cannot be triggered
  // by prose.
  const out = 'I considered a HANDOFF but everything is delivered.\n<promise>NO MORE TASKS</promise>';
  assert.equal(classify(out), COMPLETE);
});

test('garbled / truncated promise (no closing tag) → CONTINUE', () => {
  assert.equal(classify('the iteration was cut here <promise>NO MOR'), CONTINUE);
});

test('whitespace and newlines inside the wrapper are tolerated', () => {
  assert.equal(classify('<promise>\n  NO MORE TASKS\n</promise>'), COMPLETE);
});
