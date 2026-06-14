import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectViolations } from './shortcut-detector.mjs';

function diff(added = [], removed = [], file = 'src/foo.ts') {
  return [
    `--- a/${file}`,
    `+++ b/${file}`,
    '@@ -1,3 +1,3 @@',
    ' context line',
    ...removed.map((l) => `-${l}`),
    ...added.map((l) => `+${l}`),
  ].join('\n');
}

test('clean diff — no violations', () => {
  assert.deepEqual(detectViolations(diff(['const x = 1;'])), []);
});

test('eslint-disable — violation', () => {
  const v = detectViolations(diff(['// eslint-disable-next-line no-console']));
  assert.equal(v.length, 1);
  assert.match(v[0].reason, /eslint-disable/);
});

test('@ts-ignore — violation', () => {
  const v = detectViolations(diff(['// @ts-ignore']));
  assert.equal(v.length, 1);
  assert.match(v[0].reason, /@ts-ignore/);
});

test('bare as any — violation', () => {
  const v = detectViolations(diff(['const x = foo as any;']));
  assert.equal(v.length, 1);
  assert.match(v[0].reason, /as any/);
});

test('as any with inline comment — no violation (approved form)', () => {
  assert.deepEqual(
    detectViolations(diff(['const x = window as any; // google-maps: no type package'])),
    [],
  );
});

test('deleted expect — violation', () => {
  const v = detectViolations(diff([], ['  expect(result).toBe(42);']));
  assert.equal(v.length, 1);
  assert.match(v[0].reason, /assertion deleted/);
});

test('.only — violation', () => {
  const v = detectViolations(diff(['test.only("foo", () => {});']));
  assert.equal(v.length, 1);
  assert.match(v[0].reason, /skip\/only/);
});

test('.skip — violation', () => {
  const v = detectViolations(diff(['it.skip("foo", () => {});']));
  assert.equal(v.length, 1);
  assert.match(v[0].reason, /skip\/only/);
});

test('xit — violation', () => {
  const v = detectViolations(diff(['xit("foo", () => {});']));
  assert.equal(v.length, 1);
  assert.match(v[0].reason, /skip\/only/);
});

test('xdescribe — violation', () => {
  const v = detectViolations(diff(['xdescribe("suite", () => {});']));
  assert.equal(v.length, 1);
  assert.match(v[0].reason, /skip\/only/);
});

test('file path surfaced in violation', () => {
  const v = detectViolations(diff(['// eslint-disable foo'], [], 'apps/api/src/foo.ts'));
  assert.equal(v[0].file, 'apps/api/src/foo.ts');
});

test('shortcut-detector own files exempt (bootstrap)', () => {
  assert.deepEqual(
    detectViolations(diff(['// eslint-disable foo'], [], 'scripts/shortcut-detector.mjs')),
    [],
  );
  assert.deepEqual(
    detectViolations(diff(['// eslint-disable foo'], [], 'scripts/shortcut-detector.test.mjs')),
    [],
  );
});

test('diff header lines not flagged', () => {
  const raw = [
    'diff --git a/foo.ts b/foo.ts',
    'index abc..def 100644',
    '--- a/foo.ts',
    '+++ b/foo.ts',
    '@@ -1 +1 @@',
    '+const ok = 1;',
  ].join('\n');
  assert.deepEqual(detectViolations(raw), []);
});
