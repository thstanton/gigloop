import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSurfaces, surfacesOverlap, isHotFile, findOverlaps, HOT_FILES } from './claimability-surfaces.mjs';

test('canonical "## Surfaces" heading + plain bullet list (issue-authoring.md §8 example)', () => {
  const body = [
    'Some intro text.',
    '',
    '## Surfaces',
    '',
    '- features/checklist',
    '- apps/api/src/checklist',
    '',
    'Hot append-mostly shared files are noted when touched but do not count as overlap.',
    '',
    '## Auto-escalation',
  ].join('\n');
  assert.deepEqual(parseSurfaces(body), ['apps/api/src/checklist', 'features/checklist']);
});

test('legacy bolded inline annotation with backticked tokens', () => {
  const body = '**Surfaces:** `apps/web/src/features/invoices`, `apps/api/src/invoices`';
  assert.deepEqual(parseSurfaces(body), ['apps/api/src/invoices', 'apps/web/src/features/invoices']);
});

test('no Surfaces annotation at all — empty', () => {
  assert.deepEqual(parseSurfaces('Just a plain issue body with no surfaces annotation.'), []);
});

test('prose that merely mentions "surface" is not mistaken for a declaration', () => {
  const body = 'This bug surfaces only when the cache is cold. See the surfaces section for detail.';
  assert.deepEqual(parseSurfaces(body), []);
});

test('a column-0 fenced code block quoting the format as an example is ignored (regression: #904 own body)', () => {
  const body = [
    'This bug report explains the format:',
    '',
    '```',
    '## Surfaces',
    '',
    '- features/checklist',
    '- apps/api/src/checklist',
    '```',
    '',
    'That block is documentation, not a real declaration on this issue.',
  ].join('\n');
  assert.deepEqual(parseSurfaces(body), []);
});

test('an indented fence (nested under a list item — the common issue-body shape) is also skipped, not just a column-0 one', () => {
  const body = [
    'Example of the old format, indented as GitHub renders a fence under a bullet:',
    '',
    '  ```',
    '  **Surfaces:** `leaked/should-not-appear`',
    '  ```',
  ].join('\n');
  assert.deepEqual(parseSurfaces(body), []);
});

test('two canonical sections (body + a later comment, joined by \\n) union and de-duplicate', () => {
  const joined = ['## Surfaces', '', '- prisma/schema', '', '---', '', '## Surfaces', '', '- apps/api/src/bookings'].join(
    '\n',
  );
  assert.deepEqual(parseSurfaces(joined), ['apps/api/src/bookings', 'prisma/schema']);
});

test('surfacesOverlap: identical tokens collide', () => {
  assert.equal(surfacesOverlap('apps/web/src/features/invoices', 'apps/web/src/features/invoices'), true);
});

test('surfacesOverlap: same module declared under different roots collides (path-boundary suffix match)', () => {
  assert.equal(surfacesOverlap('features/bookings', 'apps/web/src/features/bookings'), true);
});

test('surfacesOverlap: unrelated modules do not collide', () => {
  assert.equal(surfacesOverlap('apps/api/src/checklist', 'apps/api/src/invoices'), false);
});

test('surfacesOverlap: a short token must match a full path segment, not just any substring', () => {
  // "voices" must not be treated as overlapping "apps/api/src/invoices" — no
  // boundary before "voices" inside "invoices".
  assert.equal(surfacesOverlap('voices', 'apps/api/src/invoices'), false);
});

test('isHotFile recognizes every declared hot file, rooted or not', () => {
  for (const hf of HOT_FILES) assert.equal(isHotFile(hf), true, hf);
  assert.equal(isHotFile('apps/web/src/lib/constants.ts'), true);
  assert.equal(isHotFile('lib/constants.ts'), true); // same path-boundary suffix rule as surfacesOverlap
  assert.equal(isHotFile('apps/web/src/lib/other.ts'), false);
});

test('findOverlaps: real overlap surfaces (e.g. #844 vs #918 both touching apps/web/src/features/invoices)', () => {
  const mine = ['apps/api/src/invoices', 'apps/web/src/features/bookings', 'apps/web/src/features/invoices'];
  const theirs = ['apps/web/src/features/invoices'];
  assert.deepEqual(findOverlaps(mine, theirs), ['apps/web/src/features/invoices']);
});

test('findOverlaps: a hot-file carve-out bullet never triggers a hard-block overlap', () => {
  const mine = ['apps/web/src/types/api.ts', 'apps/api/src/invoices'];
  const theirs = ['apps/web/src/types/api.ts', 'apps/api/src/bookings'];
  assert.deepEqual(findOverlaps(mine, theirs), []);
});

test('findOverlaps: disjoint surfaces return empty', () => {
  const mine = ['apps/api/src/mail', 'apps/api/src/templates'];
  const theirs = ['apps/web/src/features/invoices'];
  assert.deepEqual(findOverlaps(mine, theirs), []);
});
