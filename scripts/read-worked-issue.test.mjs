import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractWorkedIssue } from './read-worked-issue.mjs';

test('extracts issue from Closes #N', () => {
  assert.equal(extractWorkedIssue('feat: thing\n\nCloses #42\n'), '42');
});

test('extracts issue from Fixes #N', () => {
  assert.equal(extractWorkedIssue('fix: bug\n\nFixes #99\n'), '99');
});

test('extracts issue from Resolves #N', () => {
  assert.equal(extractWorkedIssue('fix: bug\n\nResolves #7\n'), '7');
});

test('returns empty string when no closing pattern', () => {
  assert.equal(extractWorkedIssue('chore: no closing keyword\n\nsome body'), '');
});

test('returns empty string for empty input', () => {
  assert.equal(extractWorkedIssue(''), '');
});

test('returns first match from multi-commit log (newest commit first)', () => {
  // git log outputs newest commit first
  const log = 'feat: later\n\nCloses #100\n\nfeat: earlier\n\nCloses #50\n';
  assert.equal(extractWorkedIssue(log), '100');
});

test('handles multi-word commit bodies with Closes at end', () => {
  const log = 'feat(ralph): heartbeat reads issue\n\nKey decisions: none.\n\nCloses #458\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>\n';
  assert.equal(extractWorkedIssue(log), '458');
});
