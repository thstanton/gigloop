import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findViolations, stripComments } from './check-design-tokens.mjs';

test('clean className — no violations', () => {
  assert.deepEqual(findViolations('<div className="bg-accent text-muted" />'), []);
});

test('bare bg-muted — violation, points at bg-accent', () => {
  const v = findViolations('<div className="bg-muted text-muted" />');
  assert.equal(v.length, 1);
  assert.equal(v[0].match, 'bg-muted');
  assert.match(v[0].fix, /bg-accent/);
});

test('text-muted-foreground — violation, points at text-muted', () => {
  const v = findViolations('<p className="text-muted-foreground">hi</p>');
  assert.equal(v.length, 1);
  assert.equal(v[0].match, 'text-muted-foreground');
  assert.equal(v[0].fix, 'text-muted');
});

test('translucent washes are legal', () => {
  for (const wash of ['bg-muted/20', 'bg-muted/30', 'bg-muted/40', 'bg-muted/50']) {
    assert.deepEqual(findViolations(`<div className="${wash}" />`), [], wash);
  }
});

test('variant-prefixed bare bg-muted — violation', () => {
  const v = findViolations('<div className="hover:bg-muted" />');
  assert.equal(v.length, 1);
});

test('a wash and a bare use on the same line — only the bare use is reported', () => {
  // The real TableRow case (#977): a line-based filter misses this one.
  const v = findViolations(
    '"border-b hover:bg-muted/50 data-[state=selected]:bg-muted"',
  );
  assert.equal(v.length, 1);
  assert.equal(v[0].match, 'bg-muted');
});

test('prose in a line comment is not a violation', () => {
  assert.deepEqual(findViolations('// VOID uses bg-muted and text-muted-foreground'), []);
});

test('prose in a block comment is not a violation', () => {
  assert.deepEqual(
    findViolations('/* never write bg-muted or text-muted-foreground here */'),
    [],
  );
});

test('prose in a JSX block comment is not a violation', () => {
  assert.deepEqual(findViolations('{/* bg-muted was the old way */}'), []);
});

test('a URL inside a string does not swallow the rest of the line', () => {
  // `//` in a string must not be treated as a comment — otherwise a real
  // violation after it would be silently missed.
  const v = findViolations('const a = "https://example.com"; const b = "bg-muted";');
  assert.equal(v.length, 1);
  assert.equal(v[0].match, 'bg-muted');
});

test('css: // is not a comment', () => {
  const v = findViolations('a { background: url(http://x/y); } .z { color: bg-muted; }', '.css');
  assert.equal(v.length, 1);
});

test('css: block comment prose is ignored', () => {
  assert.deepEqual(findViolations('/* bg-muted is banned */\n', '.css'), []);
});

test('line numbers are accurate after stripping', () => {
  const v = findViolations('// bg-muted in prose\n\n<div className="bg-muted" />');
  assert.equal(v.length, 1);
  assert.equal(v[0].line, 3);
});

test('stripComments preserves offsets and newlines', () => {
  const src = '// abc\nconst x = 1;\n';
  const out = stripComments(src);
  assert.equal(out.length, src.length);
  assert.equal(out.split('\n').length, src.split('\n').length);
  assert.match(out, /const x = 1;/);
  assert.doesNotMatch(out, /abc/);
});

test('escaped quote does not end the string early', () => {
  const v = findViolations('const s = "a \\" bg-muted";');
  assert.equal(v.length, 1);
});

test('variant-prefixed palette colors are violations', () => {
  const v = findViolations('<div className="hover:bg-white dark:text-slate-700" />');
  assert.deepEqual(
    v.map(({ match }) => match),
    ['bg-white', 'text-slate-700'],
  );
});

test('every supported color utility is checked', () => {
  const utilities = [
    'bg',
    'text',
    'border',
    'border-t',
    'border-r',
    'border-b',
    'border-l',
    'border-x',
    'border-y',
    'border-s',
    'border-e',
    'ring',
    'ring-offset',
    'from',
    'to',
    'via',
    'fill',
    'stroke',
    'divide',
    'outline',
    'placeholder',
    'decoration',
  ];
  const v = findViolations(`<div className="${utilities.map((utility) => `${utility}-white`).join(' ')}" />`);
  assert.equal(v.length, utilities.length);
});

test('palette colors with opacity modifiers are violations', () => {
  const v = findViolations('<div className="bg-black/80" />');
  assert.equal(v.length, 1);
  assert.equal(v[0].match, 'bg-black/80');
});

test('arbitrary CSS color values are violations', () => {
  const v = findViolations(
    '<div className="bg-[#fff] text-[rgb(1, 2, 3)] border-[hsl(0, 0%, 0%)] border-t-[#abc] text-[color:#fff] bg-[color:rgb(4,5,6)] text-[rebeccapurple] bg-[color:tomato]" />',
  );
  assert.deepEqual(
    v.map(({ match }) => match),
    [
      'bg-[#fff]',
      'text-[rgb(1, 2, 3)]',
      'border-[hsl(0, 0%, 0%)]',
      'border-t-[#abc]',
      'text-[color:#fff]',
      'bg-[color:rgb(4,5,6)]',
      'text-[rebeccapurple]',
      'bg-[color:tomato]',
    ],
  );
});

test('portal paths are exempt from palette-color checks', () => {
  for (const file of [
    'apps/web/src/features/portal/PortalPage.tsx',
    'apps/web/src/pages/portal/PortalPage.tsx',
    'apps/web/src/layouts/PortalLayout.tsx',
  ]) {
    assert.deepEqual(findViolations('<div className="bg-white text-[#fff]" />', '.tsx', file), [], file);
  }
});

test('stories and test files are exempt from palette-color checks', () => {
  for (const file of [
    'apps/web/src/components/Button.stories.tsx',
    'apps/web/src/components/Button.spec.ts',
    'apps/web/src/components/Button.test.tsx',
  ]) {
    assert.deepEqual(findViolations('<div className="bg-white" />', '.tsx', file), [], file);
  }
});

test('a palette-exempt marker with a reason exempts its line', () => {
  const v = findViolations(
    '<div className="bg-white" /> {/* palette-exempt: portal preview frame */}',
  );
  assert.deepEqual(v, []);
});

test('a palette-exempt marker without a reason is itself a violation', () => {
  const v = findViolations('{/* palette-exempt: */}');
  const markerViolation = v.find(({ match }) => match === 'palette-exempt');
  assert.ok(markerViolation);
  assert.match(markerViolation.fix, /reason/);
});

test('palette colors and marker-like prose in comments are ignored', () => {
  assert.deepEqual(
    findViolations('// bg-white text-[#fff] palette-exempt: portal preview frame'),
    [],
  );
});

test('transparent, current and inherit are not banned palette colors', () => {
  assert.deepEqual(
    findViolations(
      '<div className="bg-transparent text-current border-inherit bg-[transparent] text-[currentColor] border-[inherit]" />',
    ),
    [],
  );
});
