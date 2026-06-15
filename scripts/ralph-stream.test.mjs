import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, step, metricsLines, feedFor } from './ralph-stream.mjs';

// Mirrors the verified `claude --output-format stream-json --verbose` schema:
// system/init → assistant (content blocks + message.usage) → result (usage, num_turns,
// duration_ms, total_cost_usd, result text).
const fold = (events) => events.reduce((s, e) => step(s, e), initialState());
const linesToObj = (lines) => Object.fromEntries(lines.map((l) => l.split('=').length > 1 ? [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] : [l, '']));

const RESULT = {
  type: 'result',
  subtype: 'success',
  is_error: false,
  num_turns: 4,
  duration_ms: 7200,
  total_cost_usd: 0.123456,
  result: 'Done. <selected>430</selected> <promise>COMPLETE</promise>',
  usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 1000, cache_creation_input_tokens: 500 },
};

test('result event populates metrics from the verified schema', () => {
  const m = linesToObj(metricsLines(fold([RESULT])));
  assert.equal(m.NUM_TURNS, '4');
  assert.equal(m.DURATION_S, '7'); // 7200ms rounded to seconds
  assert.equal(m.TOKENS_IN, '10');
  assert.equal(m.TOKENS_OUT, '20');
  assert.equal(m.CACHE_READ, '1000');
  assert.equal(m.CACHE_WRITE, '500');
  assert.equal(m.COST_USD, '0.1235'); // 4dp
  assert.equal(m.RESULT_SUBTYPE, 'success');
  assert.equal(m.RESULT_IS_ERROR, 'false');
  assert.equal(m.RESULT_SEEN, 'true');
});

test('finalText is exactly the result field — the unchanged <selected>/<promise> channel', () => {
  const s = fold([RESULT]);
  assert.equal(s.finalText, RESULT.result);
  assert.match(s.finalText, /<selected>430<\/selected>/);
  assert.match(s.finalText, /<promise>COMPLETE<\/promise>/);
});

test('no result event (crash / kill) → RESULT_SEEN=false and live-counter fallbacks', () => {
  const events = [
    { type: 'system', subtype: 'init', model: 'sonnet', tools: [1, 2, 3] },
    { type: 'assistant', message: { model: 'sonnet', content: [{ type: 'text', text: 'thinking' }], usage: { input_tokens: 5, output_tokens: 2 } } },
    { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Edit', input: { path: 'x' } }] } },
  ];
  const s = fold(events);
  const m = linesToObj(metricsLines(s, { durationFallback: 99 }));
  assert.equal(m.RESULT_SEEN, 'false');
  assert.equal(m.RESULT_IS_ERROR, 'true'); // unknown outcome treated as error
  assert.equal(m.NUM_TURNS, '2');          // falls back to counted assistant turns
  assert.equal(m.DURATION_S, '99');        // falls back to supplied wall-clock
  assert.equal(s.finalText, '');           // nothing to feed the decision channel
});

test('assistant events advance turn count and capture latest usage', () => {
  const s = fold([
    { type: 'assistant', message: { content: [{ type: 'text', text: 'a' }], usage: { input_tokens: 1, output_tokens: 1 } } },
    { type: 'assistant', message: { content: [{ type: 'text', text: 'b' }], usage: { input_tokens: 9, output_tokens: 9 } } },
  ]);
  assert.equal(s.turns, 2);
  assert.equal(s.lastUsage.input_tokens, 9);
});

test('malformed / unknown events never throw and are ignored', () => {
  const s = initialState();
  assert.doesNotThrow(() => step(s, null));
  assert.doesNotThrow(() => step(s, 'not an object'));
  assert.doesNotThrow(() => step(s, { type: 'rate_limit_event' }));
  assert.doesNotThrow(() => step(s, { type: 'assistant' })); // missing message
  assert.equal(s.turns, 1); // the bare assistant counted; no crash
});

test('feedFor renders readable lines without throwing on odd input', () => {
  const init = feedFor({ type: 'system', subtype: 'init', model: 'sonnet', tools: [] }, initialState());
  assert.match(init[0], /init/);
  const tool = feedFor({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: { cmd: 'ls' } }] } }, initialState());
  assert.match(tool[0], /Bash/);
  assert.deepEqual(feedFor(null, initialState()), []);
});
