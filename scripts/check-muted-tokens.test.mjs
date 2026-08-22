import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findViolations, stripComments } from './check-muted-tokens.mjs';

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
