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

test('replaced expect (delete old + add new, net >= 0) — no violation', () => {
  // Replacing an assertion with a better one is not a quality regression.
  const v = detectViolations(diff(
    ['  expect(where.status).toBeUndefined();'],
    ['  expect(where.status).toEqual({ not: BookingStatus.CANCELLED });'],
  ));
  assert.deepEqual(v, []);
});

test('net loss of expects across a file — violation', () => {
  // Two removed, one added: net -1 is a real regression.
  const v = detectViolations(diff(
    ['  expect(a).toBe(1);'],
    ['  expect(a).toBe(1);', '  expect(b).toBe(2);'],
  ));
  assert.equal(v.length, 2);
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

test('markdown/docs exempt — prose naming a pattern is not a suppression', () => {
  // Docs (PROMPT.md, CLAUDE.md, ADRs) must be able to name the forbidden patterns.
  assert.deepEqual(
    detectViolations(diff(['- an `eslint-disable`, an `as any`, a skipped test'], [], 'PROMPT.md')),
    [],
  );
  assert.deepEqual(
    detectViolations(diff(['Never add an `as any` without a comment.'], [], 'docs/adr/0040-agent-loop.md')),
    [],
  );
});

test('deleted file (assertions in deleted file) — no violation', () => {
  // When a file is deleted ("+++ /dev/null"), its removed assertions should not be
  // attributed to a neighbouring file in the diff. Deleting a file and replacing its
  // component with a new one (with new tests) is not a quality regression.
  const raw = [
    'diff --git a/foo.stories.tsx b/foo.stories.tsx',
    'index abc..def 100644',
    '--- a/foo.stories.tsx',
    '+++ /dev/null',
    '@@ -1,5 +0,0 @@',
    '-export const Foo = {',
    '-  play: async ({ canvas }) => {',
    '-    await expect(canvas.getByText("hello")).toBeVisible();',
    '-  },',
    '-};',
    'diff --git a/bar.stories.tsx b/bar.stories.tsx',
    'index abc..def 100644',
    '--- a/bar.stories.tsx',
    '+++ b/bar.stories.tsx',
    '@@ -1 +0,0 @@',
    '+const x = 1;',
  ].join('\n');
  assert.deepEqual(detectViolations(raw), []);
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

// ── Bare-id mutation guard (#710 / ADR-0061) ──────────────────────────────────

const REPO = 'apps/api/src/invoices/invoices.repository.ts';

test('bare-id inline mutation in a repository — violation', () => {
  const v = detectViolations(diff(['    return this.prisma.invoice.delete({ where: { id } });'], [], REPO));
  assert.equal(v.length, 1);
  assert.match(v[0].reason, /bare-id mutation/);
});

test('bare-id multi-line mutation in a repository — violation', () => {
  const v = detectViolations(
    diff(
      ['    return this.prisma.invoice.update({', '      where: { id },', '      data: dto,', '    });'],
      [],
      REPO,
    ),
  );
  assert.equal(v.length, 1);
  assert.match(v[0].reason, /bare-id mutation/);
});

test('id with an alias value (where: { id: setId }) — violation', () => {
  const v = detectViolations(diff(['    return this.prisma.performanceSet.delete({ where: { id: setId } });'], [], REPO));
  assert.equal(v.length, 1);
});

test('userId-scoped mutation (extendedWhereUnique) — no violation', () => {
  const v = detectViolations(diff(['    return this.prisma.invoice.update({ where: { id, userId }, data: dto });'], [], REPO));
  assert.deepEqual(v, []);
});

test('userId-scoped multi-line mutation — no violation', () => {
  const v = detectViolations(
    diff(
      ['    return this.prisma.invoice.update({', '      where: { id, userId },', '      data: dto,', '    });'],
      [],
      REPO,
    ),
  );
  assert.deepEqual(v, []);
});

test('child-scoped mutation (where: { bookingId }) — no violation', () => {
  const v = detectViolations(diff(['    return this.prisma.musicFormConfig.delete({ where: { bookingId } });'], [], REPO));
  assert.deepEqual(v, []);
});

test('scoped-upstream suppress comment — no violation', () => {
  const v = detectViolations(
    diff(['    return this.prisma.invoice.delete({ where: { id } }); // scoped-upstream: findOne proved ownership'], [], REPO),
  );
  assert.deepEqual(v, []);
});

test('scoped-upstream suppress on a multi-line mutation verb line — no violation', () => {
  const v = detectViolations(
    diff(
      ['    return this.prisma.invoice.update({ // scoped-upstream: proven owned', '      where: { id },', '      data: dto,', '    });'],
      [],
      REPO,
    ),
  );
  assert.deepEqual(v, []);
});

test('bare-id read (findUnique) in a repository — no violation (mutations only)', () => {
  const v = detectViolations(diff(['    return this.prisma.invoice.findUnique({ where: { id } });'], [], REPO));
  assert.deepEqual(v, []);
});

test('bare-id mutation outside a repository file — no violation (repo-scoped rule)', () => {
  const v = detectViolations(diff(['    return this.prisma.invoice.delete({ where: { id } });'], [], 'apps/api/src/invoices/invoices.service.ts'));
  assert.deepEqual(v, []);
});
