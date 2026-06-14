import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, CONTINUE, COMPLETE } from './loop-decision.mjs';

// Truth table (AC):
// red gate -> CONTINUE even with promise + 0 remaining
// green + promise + 0 remaining -> COMPLETE
// green + 0 remaining, no promise -> COMPLETE
// green + remaining > 0 -> CONTINUE

test('red gate → CONTINUE even with promise and 0 remaining', () => {
  assert.equal(decide(1, true, 0), CONTINUE);
});

test('red gate → CONTINUE with no promise and remaining work', () => {
  assert.equal(decide(1, false, 3), CONTINUE);
});

test('green + promise + 0 remaining → COMPLETE', () => {
  assert.equal(decide(0, true, 0), COMPLETE);
});

test('green + 0 remaining, no promise → COMPLETE', () => {
  assert.equal(decide(0, false, 0), COMPLETE);
});

test('green + remaining > 0 → CONTINUE', () => {
  assert.equal(decide(0, false, 2), CONTINUE);
});

test('green + promise + remaining > 0 → CONTINUE', () => {
  assert.equal(decide(0, true, 1), CONTINUE);
});

test('non-zero gate codes other than 1 → CONTINUE', () => {
  assert.equal(decide(127, true, 0), CONTINUE);
  assert.equal(decide(2, false, 0), CONTINUE);
});
